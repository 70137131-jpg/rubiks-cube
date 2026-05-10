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

def _apply_move(state: list, move: str) -> list:
    """Return a new 54-element list after applying a single kociemba-style move.
    
    state  – list of 54 single-char kociemba face letters (U R F D L B order).
    move   – one of the 18 move strings in _SCRAMBLE_MOVES.
    """
    # Index layout for each face (9 stickers per face):
    # U: 0-8   R: 9-17   F: 18-26   D: 27-35   L: 36-44   B: 45-53
    # Within a face, row-major left→right, top→bottom when viewed from outside.
    s = list(state)

    def cycle4(a, b, c, d):
        s[a], s[b], s[c], s[d] = s[d], s[a], s[b], s[c]

    def rotate_face_cw(f):
        """Rotate a 3×3 face clockwise (indices 0-8 of the face block, offset by f*9)."""
        o = f * 9
        s[o], s[o+1], s[o+2], s[o+3], s[o+4], s[o+5], s[o+6], s[o+7], s[o+8] = \
            s[o+6], s[o+3], s[o+0], s[o+7], s[o+4], s[o+1], s[o+8], s[o+5], s[o+2]

    def rotate_face_ccw(f):
        o = f * 9
        s[o], s[o+1], s[o+2], s[o+3], s[o+4], s[o+5], s[o+6], s[o+7], s[o+8] = \
            s[o+2], s[o+5], s[o+8], s[o+1], s[o+4], s[o+7], s[o+0], s[o+3], s[o+6]

    base = move.replace('i', '').replace('2', '')
    is_prime = 'i' in move
    is_double = '2' in move
    reps = 2 if is_double else (3 if is_prime else 1)

    for _ in range(reps):
        if base == 'U':
            rotate_face_cw(0)
            cycle4(9,18,36,45); cycle4(10,19,37,46); cycle4(11,20,38,47)
        elif base == 'D':
            rotate_face_cw(3)
            cycle4(15,48,42,21); cycle4(16,49,43,22); cycle4(17,50,44,23)
        elif base == 'R':
            rotate_face_cw(1)
            cycle4(2,18,29,47); cycle4(5,21,32,50); cycle4(8,24,35,53)
        elif base == 'L':
            rotate_face_cw(4)
            cycle4(0,45,27,20); cycle4(3,48,30,23); cycle4(6,51,33,26)
        elif base == 'F':
            rotate_face_cw(2)
            cycle4(6,9,29,44); cycle4(7,12,28,41); cycle4(8,15,27,38)
        elif base == 'B':
            rotate_face_cw(5)
            cycle4(0,36,35,11); cycle4(1,39,34,14); cycle4(2,42,33,17)
    return s


def _scramble(n: int = 20) -> list:
    """Apply n random moves to a solved cube, avoiding redundant back-to-back moves."""
    state = list(_SOLVED_KOCIEMBA)
    last_base = None
    for _ in range(n):
        # Pick a move with a different base face than the last
        candidates = [m for m in _SCRAMBLE_MOVES
                      if m.replace('i','').replace('2','') != last_base]
        move = random.choice(candidates)
        state = _apply_move(state, move)
        last_base = move.replace('i','').replace('2','')
    return state


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
