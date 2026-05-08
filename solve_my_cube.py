import argparse
from rubik.cube import Cube
from rubik.solve import Solver
from rubik.optimize import optimize_moves

def solve_my_cube(cube_str):
    # Initialize the cube
    try:
        my_cube = Cube(cube_str)
    except AssertionError:
        print("Error: The cube string must contain exactly 54 color characters (ignoring spaces).")
        return

    print("Initial Cube State:")
    print(my_cube)

    # Solve it
    solver = Solver(my_cube)
    solver.solve()

    if my_cube.is_solved():
        # Optimize the moves to make the solution shorter
        opt_moves = optimize_moves(solver.moves)
        print("\nSuccess! The cube is solved.")
        print(f"Solution ({len(opt_moves)} moves): {' '.join(opt_moves)}")
    else:
        print("\nFailed to solve the cube. Please check if your input string represents a valid, solvable cube.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Solve a specific Rubik's Cube.")
    parser.add_argument(
        "cube_string", 
        type=str, 
        help="A 54-character string representing the cube. Whitespace is ignored."
    )
    args = parser.parse_args()
    
    solve_my_cube(args.cube_string)
