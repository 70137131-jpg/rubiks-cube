from flask import Flask, render_template, request, jsonify
import kociemba

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

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
        # Kociemba throws ValueError if the cube is physically impossible/unsolvable
        return jsonify({
            "status": "error", 
            "message": "Cube is unsolvable. Please check if your colors are placed correctly."
        }), 400
    except Exception as e:
        return jsonify({"status": "error", "message": f"Processing error: {str(e)}"}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000)
