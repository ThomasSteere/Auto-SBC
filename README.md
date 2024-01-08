## EA FC 24 Automated SBC Solving ⚽

### Notes
`The goal is to automatically solve the SBC using the currently available players in the club with the minimum cost based on futbin prices.`

The project utilizes [tamper monkey script](https://www.tampermonkey.net/) to output the users Club Player Data.
Install the tampermonkey extension and then install [the frontend script](https://github.com/ThomasSteere/AI-SBC/raw/main/tampermonkey-ai-sbc.user.js)

This script implements a number of backend functions but the main feature is a Solve SBC button on each SBC that send players to the backend solver
![solveBtn](https://github.com/ThomasSteere/AI-SBC/blob/main/pictures/solveBtn.jpg?raw=true)

Players will also get SBC Lock button to not send use this player in the solution (if its a duplicate it will get sent)
Also a must use button is available which will set the cost of this player to 0 so it will get used if it can be fit into the SBC
![solveBtn](https://github.com/ThomasSteere/AI-SBC/blob/main/pictures/Player.jpg?raw=true)


The constraints used in the program are created in the `optimize.py` file and the optimization problem is solved using [Google CP-SAT solver](https://developers.google.com/optimization/cp/cp_solver).

The program implements the SBC requirements in `optimize.py`.

To run the backend, simply run `python -m uvicorn main:app --reload` after installing the required dependencies.

### Dependencies

Run `pip3 install -r requirements.txt` to install the required dependencies.

- [Google OR-Tools v9.8](https://github.com/google/or-tools)

- Python 3.9

- pandas and openpyxl

- fastapi

- uvicorn