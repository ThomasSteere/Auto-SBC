## EA FC 24 Automated SBC Solving ⚽

#### The goal is to automatically solve the SBC using the currently available players in the club with the minimum cost.

### Frontend
The project utilizes [tamper monkey script](https://www.tampermonkey.net/) to output the users Club Player Data.
Install the tampermonkey extension and then install [the frontend script](https://github.com/ThomasSteere/AI-SBC/raw/main/tampermonkey-ai-sbc.user.js)

This script implements a number of backend functions but the main feature is a Solve SBC button on each SBC that send players to the backend solver
![solveBtn](https://github.com/ThomasSteere/AI-SBC/blob/main/pictures/solveBtn.jpg?raw=true)

Players will also get SBC Lock button to not send use this player in the solution (if its a duplicate it will get sent)
Also a must use button is available which will set the cost of this player to 0 so it will get most likely get used if it can be fit into the SBC.
This is useful to get rid of high rated duplicates.
![solveBtn](https://github.com/ThomasSteere/AI-SBC/blob/main/pictures/Player.jpg?raw=true)

Current base price is based off of Futbin prices cached for 60 minutes
- SBC Prices used in calculations ->
	- Duplicates discounted to 10%
	- Untradable discounted to 80%
	- Objective Cards uses [cheapest by rating ](https://www.futbin.com/home-tab/cheapest-by-rating) with premium of 50% added bounded by players max and min price limit

### Backend

Run `pip3 install -r requirements.txt` to install the required dependencies.
To run the backend, simply run `python -m uvicorn main:app --reload` after installing python and the required dependencies.
- [Google OR-Tools v9.8](https://github.com/google/or-tools)
- Python 3.9
- pandas
- openpyxl
- fastapi
- uvicorn

The constraints used in the program are created in the `optimize.py` file based of the SBC requirements and the optimization problem is solved using [Google CP-SAT solver](https://developers.google.com/optimization/cp/cp_solver).

### Shoutouts
Thanks to [Regista6](https://github.com/Regista6) for showing the way with the google OR tools
