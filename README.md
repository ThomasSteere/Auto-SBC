## EA FC 24 Automated SBC Solving ⚽

### Notes

The project utilizes tamper monkey script to output the users Club Player Data
`The goal is to obtain the squad with the minimum cost based on futbin prices.`

The constraints used in the program are created in the `optimize.py` file and the optimization problem is solved using [Google CP-SAT solver](https://developers.google.com/optimization/cp/cp_solver).

The program implements most of the common constraints (`L571-607` in `optimize.py`).

To execute the program, simply run `python -m uvicorn main:app --reload` after installing the required dependencies.

### Dependencies

Run `pip3 install -r requirements.txt` to install the required dependencies.

- [Google OR-Tools v9.8](https://github.com/google/or-tools)

- Python 3.9

- pandas and openpyxl

- fastapi

- uvicorn