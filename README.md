# 3D Rubik's Cube Solver

A sleek, interactive web-based 3D Rubik's Cube solver. This application allows you to virtually interact with a Rubik's Cube, scramble it, and watch as it automatically finds and animates the optimal solution to solve it using the Kociemba algorithm.

## Features

*   **Interactive 3D Interface:** A fully manipulatable 3D Rubik's cube right in your browser.
*   **Optimal Solver:** Uses the highly efficient Kociemba algorithm to find solutions with the minimal number of moves.
*   **Solution Animation:** Watch the cube solve itself step-by-step with smooth 3D animations.
*   **Scramble & Solve:** Easily scramble the cube randomly and then solve it with a click of a button.
*   **Modern Design:** Clean, modern user interface with intuitive controls.

## Tech Stack

*   **Backend:** Python, Flask, `kociemba` library
*   **Frontend:** HTML5, Vanilla CSS, JavaScript (Three.js for 3D rendering)

## Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/70137131-jpg/rubiks-cube.git
    cd rubiks-cube
    ```

2.  **Create a virtual environment (optional but recommended):**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows use: venv\Scripts\activate
    ```

3.  **Install the requirements:**
    ```bash
    pip install flask kociemba
    ```

## Usage

1.  Start the Flask server:
    ```bash
    python app.py
    ```
2.  Open your web browser and navigate to:
    `http://127.0.0.1:5000`
3.  Use the on-screen controls to scramble the cube, or manually rotate the layers.
4.  Click "Solve" to see the magic happen!

## How it works

The frontend uses Three.js to render a visual representation of a Rubik's Cube and handles user interactions. When the user clicks "Solve", the current state of the cube (the colors on each face) is extracted and sent to the Python Flask backend. The backend uses the `kociemba` library to calculate the optimal sequence of moves to solve the cube. This sequence is sent back to the frontend, which then animates the moves step-by-step.
