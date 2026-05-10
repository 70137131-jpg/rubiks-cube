from flask import Flask, render_template, request, jsonify
import kociemba
import random

app = Flask(__name__)

# Solved cube in kociemba face-order (U R F D L B), each face top-left → bottom-right.
# Letters are kociemba face IDs: U=white, R=red, F=green, D=yellow, L=orange, B=blue
_SOLVED_KOCIEMBA = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB"

# Standard WCA outer moves (no slice/cube-rotation to keep state valid for kociemba)
_SCRAMBLE_MOVES = [
    "U", "Ui", "U2",
    "D", "Di", "D2",
    "R", "Ri", "R2",
    "L", "Li", "L2",
    "F", "Fi", "F2",
    "B", "Bi", "B2",
]

# Map kociemba face ID → UI color code used in the frontend
_FACE_TO_COLOR = {'U': 'W', 'R': 'R', 'F': 'G', 'D': 'Y', 'L': 'O', 'B': 'B'}

def _scramble(n: int = 20) -> list:
    """Generate a random valid scrambled cube state in Kociemba face-order."""
    from rubik.cube import Cube
    c = Cube("UUUUUUUUULLLFFFRRRBBBLLLFFFRRRBBBLLLFFFRRRBBBDDDDDDDDD")
    last_base = None
    for _ in range(n):
        candidates = [m for m in _SCRAMBLE_MOVES if m.replace('i','').replace('2','') != last_base]
        move = random.choice(candidates)
        base = move[0]
        if '2' in move:
            getattr(c, base)()
            getattr(c, base)()
        elif 'i' in move:
            getattr(c, base + 'i')()
        else:
            getattr(c, base)()
        last_base = base
        
    s = c.flat_str()
    U = s[0:9]
    R = s[15:18] + s[27:30] + s[39:42]
    F = s[12:15] + s[24:27] + s[36:39]
    D = s[45:54]
    L = s[9:12] + s[21:24] + s[33:36]
    B = s[18:21] + s[30:33] + s[42:45]
    
    return list(U + R + F + D + L + B)



def _state_to_face_dict(state: list) -> dict:
    """Convert 54-element kociemba state list to the face dict expected by the frontend."""
    face_order = ['U', 'R', 'F', 'D', 'L', 'B']
    result = {}
    for i, face in enumerate(face_order):
        result[face] = [_FACE_TO_COLOR[c] for c in state[i*9:(i+1)*9]]
    return result

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/sw.js')
def sw():
    return app.send_static_file('sw.js')

@app.route('/randomize', methods=['GET'])
def randomize_cube():
    """Generate a random but valid scrambled cube state and return it as a face dict."""
    try:
        state = _scramble(n=20)
        face_dict = _state_to_face_dict(state)
        return jsonify({"status": "success", "cube": face_dict})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

def format_kociemba_state(cube_state_dict):
    """
    Parses the incoming JSON payload (the 54 sticker colors in a dict of faces).
    Returns the 54-character string format expected by kociemba: U, R, F, D, L, B.
    """
    color_to_face = {
        'W': 'U',
        'R': 'R',
        'G': 'F',
        'Y': 'D',
        'O': 'L',
        'B': 'B'
    }
    
    kociemba_str = ""
    for face in ['U', 'R', 'F', 'D', 'L', 'B']:
        for color in cube_state_dict[face]:
            kociemba_str += color_to_face[color]
            
    return kociemba_str

@app.route('/solve', methods=['POST'])
def solve_cube():
    data = request.json
    
    try:
        cube_str = format_kociemba_state(data)
        
        if len(cube_str) != 54:
            return jsonify({"status": "error", "message": "Invalid cube state length."}), 400
            
        # kociemba.solve returns a string like "R U R' D2 F2"
        # If the cube is already solved, it might raise an error or return an empty string.
        # Let's handle the already solved state manually to be safe.
        if cube_str == "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB":
            return jsonify({
                "status": "success", 
                "solution": "",
                "move_count": 0
            })

        solution = kociemba.solve(cube_str)
        
        # Format the solution to replace ' with i so our JS animation understands it
        solution_str = solution.replace("'", "i")
        move_count = len(solution_str.split(' '))
        
        return jsonify({
            "status": "success", 
            "solution": solution_str,
            "move_count": move_count
        })
    except ValueError as e:
        error_msg = str(e)
        friendly_msg = "The cube is unsolvable. Please double-check your colors."
        
        if "Error 1" in error_msg:
            friendly_msg = "Incorrect colors! There must be exactly 9 tiles of each color."
        elif "Error 2" in error_msg:
            friendly_msg = "Invalid edges! Check for duplicate or missing edge pieces."
        elif "Error 3" in error_msg:
            friendly_msg = "Wait! A single edge piece appears to be flipped impossibly."
        elif "Error 4" in error_msg:
            friendly_msg = "Invalid corners! Check for duplicate or missing corner pieces."
        elif "Error 5" in error_msg:
            friendly_msg = "Hold on! A corner piece seems to be twisted impossibly."
        elif "Error 6" in error_msg:
            friendly_msg = "Impossible swap! Two pieces are exchanged. Check your placement."
            
        return jsonify({
            "status": "error", 
            "message": friendly_msg
        }), 400
    except Exception as e:
        return jsonify({"status": "error", "message": f"Processing error: {str(e)}"}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000)
