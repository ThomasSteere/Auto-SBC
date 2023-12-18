'''INPUTS'''

NUM_PLAYERS = 3

# This can be used to fix specific players and optimize the rest.
# Find the Row_ID (starts from 2) of each player to be fixed
# from the club dataset and plug that in.
FIX_PLAYERS = []


# Change the nature of the objective.
# By default, the solver tries to minimize the overall cost.
# Set only one of the below to True to change the objective type.
MINIMIZE_MAX_COST = False # This minimizes the max cost within a solution. This is worth a try but not that effective.
MAXIMIZE_TOTAL_COST = False # Could be used for building a good team.

# Set only one of the below to True and the other to False. Both can't be False.
USE_PREFERRED_POSITION = False
USE_ALTERNATE_POSITIONS = True

# Set only one of the below to True and the others to False if duplicates are to be prioritized.
USE_ALL_DUPLICATES = False
USE_AT_LEAST_HALF_DUPLICATES = False
USE_AT_LEAST_ONE_DUPLICATE = False

# Which cards should be considered Rare or Common?
# Source: https://www.fut.gg/rarities/
# Source: https://www.ea.com/en-gb/games/fifa/fifa-23/news/explaining-rarity-in-fifa-ultimate-team
# Source: https://www.reddit.com/r/EASportsFC/comments/pajy29/how_do_ea_determine_wether_a_card_is_rare_or_none/
# Note: Apparently, EA randomly assigns a card as Rare. I kind of forgot to factor in this fact.
# Below is not a fool-proof solution, more so because most cards are listed as 'Special' in the club dataset :)
# Keep adding things here, especially if you are customizing the 'Rarity' column by replacing 'Special'
# with the actual Rarity, like say 'TOTW'.
# Note: Everything else is considered a Common card.
CONSIDER_AS_RARE = {'Rarity': ['Rare', 'UCL Road to the Knockouts'],
                    'League': ['Libertadores'], 'Country': [], 'Club': ['ICON', 'HERO'],
                    'Row_ID': []}

clubId = []
NUM_clubId = []  # Total players from i^th list >= NUM_clubId[i]

MAX_NUM_clubId = 2  # Same Club Count: Max X / Max X Players from the Same Club
MIN_NUM_clubId = 2  # Same Club Count: Min X / Min X Players from the Same Club
NUM_UNIQUE_clubId = [5, "Max"]  # Clubs: Max / Min / Exactly X


RARITY_1 = [['Gold', 'TOTW']]
NUM_RARITY_1 = [1]  # This is for cases like "Gold IF: Min X (0/X)"

# [Rare, Common, TOTW, Gold, Silver, Bronze ... etc]
# Note: Unfortunately several cards like 'TOTW' are listed as 'Special'
RARITY_2 = ["Rare", "Gold", "Bronze"]
NUM_RARITY_2 = [0, 0, 11]  # Total players from i^th Rarity >= NUM_RARITY_2[i]

SQUAD_RATING = 0 # Squad Rating: Min XX

MIN_OVERALL = []
NUM_MIN_OVERALL = []  # Minimum OVR of XX : Min X

CHEM_PER_PLAYER = 0  # Chemistry Points Per Player: Min X

'''INPUTS'''

SBCEligibilityKey = {
    "0": "TEAM_STAR_RATING",
    "2": "PLAYER_COUNT",
    "3": "PLAYER_QUALITY",
    "4": "SAME_NATION_COUNT",
    "5": "SAME_leagueId_COUNT",
    "6": "SAME_clubId_COUNT",
    "7": "NATION_COUNT",
    "8": "leagueId_COUNT",
    "9": "clubId_COUNT",
    "10": "NATION_ID",
    "11": "leagueId_ID",
    "12": "clubId_ID",
    "13": "SCOPE",
    "15": "LEGEND_COUNT",
    "16": "NUM_TROPHY_REQUIRED",
    "17": "PLAYER_LEVEL",
    "18": "PLAYER_RARITY",
    "19": "TEAM_RATING",
    "21": "PLAYER_COUNT_COMBINED",
    "25": "PLAYER_RARITY_GROUP",
    "26": "PLAYER_MIN_OVR",
    "27": "PLAYER_EXACT_OVR",
    "28": "PLAYER_MAX_OVR",
    "30": "FIRST_OWNER_PLAYERS_COUNT",
    "33": "PLAYER_TRADABILITY",
    "35": "CHEMISTRY_POINTS",
    "36": "ALL_PLAYERS_CHEMISTRY_POINTS",
    "TEAM_STAR_RATING": 0,
    "PLAYER_COUNT": 2,
    "PLAYER_QUALITY": 3,
    "SAME_NATION_COUNT": 4,
    "SAME_leagueId_COUNT": 5,
    "SAME_clubId_COUNT": 6,
    "NATION_COUNT": 7,
    "leagueId_COUNT": 8,
    "clubId_COUNT": 9,
    "NATION_ID": 10,
    "leagueId_ID": 11,
    "clubId_ID": 12,
    "SCOPE": 13,
    "LEGEND_COUNT": 15,
    "NUM_TROPHY_REQUIRED": 16,
    "PLAYER_LEVEL": 17,
    "PLAYER_RARITY": 18,
    "TEAM_RATING": 19,
    "PLAYER_COUNT_COMBINED": 21,
    "PLAYER_RARITY_GROUP": 25,
    "PLAYER_MIN_OVR": 26,
    "PLAYER_EXACT_OVR": 27,
    "PLAYER_MAX_OVR": 28,
    "FIRST_OWNER_PLAYERS_COUNT": 30,
    "PLAYER_TRADABILITY": 33,
    "CHEMISTRY_POINTS": 35,
    "ALL_PLAYERS_CHEMISTRY_POINTS": 36
}



status_dict = {
    0: "UNKNOWN: The status of the model is still unknown. A search limit has been reached before any of the statuses below could be determined.",
    1: "MODEL_INVALID: The given CpModelProto didn't pass the validation step.",
    2: "FEASIBLE: A feasible solution has been found. But the search was stopped before we could prove optimality.",
    3: "INFEASIBLE: The problem has been proven infeasible.",
    4: "OPTIMAL: An optimal feasible solution has been found."
}

def calc_squad_rating(rating):
    '''https://www.reddit.com/r/EASportsFC/comments/5osq7k/new_overall_rating_figured_out'''
    rat_sum = sum(rating)
    avg_rat = rat_sum / NUM_PLAYERS
    excess = sum(max(rat - avg_rat, 0) for rat in rating)
    return round(rat_sum + excess) // NUM_PLAYERS

LOG_RUNTIME = True
