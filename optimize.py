import json
import input
from threading import Timer
import time
from ortools.sat.python import cp_model


def runtime(func):
    '''Wrapper function to log the execution time'''
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        seconds = round(time.time() - start, 2)
        print(f"Processing time {func.__name__}: {seconds} seconds")
        return result
    return wrapper 


class ObjectiveEarlyStopping(cp_model.CpSolverSolutionCallback):
    '''Stop the search if the objective remains the same for X seconds'''

    def __init__(self, timer_limit: int):
        super().__init__()
        self._timer_limit = timer_limit
        self._timer = None
        


    def on_solution_callback(self):
        '''This is called everytime a solution with better objective is found.'''
        self._reset_timer()

    def _reset_timer(self):
        if self._timer:
            self._timer.cancel()
        self._timer = Timer(self._timer_limit, self.StopSearch)
        self._timer.start()

    def StopSearch(self):
        print(f"{self._timer_limit} seconds without improvement in objective. ")
        super().StopSearch()


@runtime
def create_var(model, df, map_idx, num_cnts):
    '''Create the relevant variables'''
    num_players, num_teamIds, num_leagueId, num_nationId = num_cnts[
        0], num_cnts[1], num_cnts[2], num_cnts[3]

    player = []  # player[i] = 1 => i^th player is considered and 0 otherwise
    chem = []  # chem[i] = chemistry of i^th player

    # Preprocessing things to speed-up model creation time.
    # Thanks Gregory Wullimann !!
    players_grouped = {
        "teamId": {}, "leagueId": {}, "nationId": {}, "possiblePositions": {},
        "rating": {}, "ratingTier": {}, "groups": {}, "rarityId": {},"name": {}
    }
    for i in range(num_players):
        player.append(model.NewBoolVar(f"player{i}"))
        chem.append(model.NewIntVar(0, 3, f"chem{i}"))
        players_grouped["teamId"][map_idx["teamId"][df.at[i, "teamId"]]] = players_grouped["teamId"].get(
            map_idx["teamId"][df.at[i, "teamId"]], []) + [player[i]]
        players_grouped["leagueId"][map_idx["leagueId"][df.at[i, "leagueId"]]] = players_grouped["leagueId"].get(
            map_idx["leagueId"][df.at[i, "leagueId"]], []) + [player[i]]
        players_grouped["nationId"][map_idx["nationId"][df.at[i, "nationId"]]] = players_grouped["nationId"].get(
            map_idx["nationId"][df.at[i, "nationId"]], []) + [player[i]]
        players_grouped["possiblePositions"][map_idx["possiblePositions"][df.at[i, "possiblePositions"]]] = players_grouped["possiblePositions"].get(
            map_idx["possiblePositions"][df.at[i, "possiblePositions"]], []) + [player[i]]
        players_grouped["rating"][map_idx["rating"][df.at[i, "rating"]]] = players_grouped["rating"].get(
            map_idx["rating"][df.at[i, "rating"]], []) + [player[i]]
        players_grouped["ratingTier"][map_idx["ratingTier"][df.at[i, "ratingTier"]]] = players_grouped["ratingTier"].get(
            map_idx["ratingTier"][df.at[i, "ratingTier"]], []) + [player[i]]
        players_grouped["groups"][map_idx["groups"][df.at[i, "groups"]]] = players_grouped["groups"].get(
            map_idx["groups"][df.at[i, "groups"]], []) + [player[i]]
        players_grouped["rarityId"][map_idx["rarityId"][df.at[i, "rarityId"]]] = players_grouped["rarityId"].get(
            map_idx["rarityId"][df.at[i, "rarityId"]], []) + [player[i]]
        players_grouped["name"][map_idx["name"][df.at[i, "name"]]] = players_grouped["name"].get(
            map_idx["name"][df.at[i, "name"]], []) + [player[i]]

    # These variables are basically chemistry of each teamId, leagueId and nation
    z_teamId = [model.NewIntVar(0, 3, f"z_teamId{i}") for i in range(num_teamIds)]
    z_leagueId = [model.NewIntVar(
        0, 3, f"z_leagueId{i}") for i in range(num_leagueId)]
    z_nation = [model.NewIntVar(
        0, 3, f"z_nation{i}") for i in range(num_nationId)]

    # Needed for chemistry constraint
    b_c = [[model.NewBoolVar(f"b_c{j}{i}")
            for i in range(4)]for j in range(num_teamIds)]
    b_l = [[model.NewBoolVar(f"b_l{j}{i}")
            for i in range(4)]for j in range(num_leagueId)]
    b_n = [[model.NewBoolVar(f"b_n{j}{i}") for i in range(4)]
           for j in range(num_nationId)]

    # These variables represent whether a particular teamId, leagueId or nation is
    # considered in the final solution or not
    teamId = [model.NewBoolVar(f"teamId_{i}") for i in range(num_teamIds)]
    nationId = [model.NewBoolVar(f"nationId_{i}") for i in range(num_nationId)]
    leagueId = [model.NewBoolVar(f"leagueId_{i}") for i in range(num_leagueId)]
    return model, player, chem, z_teamId, z_leagueId, z_nation, b_c, b_l, b_n, teamId, nationId, leagueId, players_grouped


@runtime
def create_basic_constraints(df, model, player, map_idx, players_grouped, num_cnts, NUM_PLAYERS):
    '''Create some essential constraints'''
    # Max players in squad
    model.Add(cp_model.LinearExpr.Sum(player) == NUM_PLAYERS)

    # Unique players constraint. Currently different players of same name not present in dataset.
    # Same player with multiple card versions present.
    for idx, expr in players_grouped["name"].items():
        model.Add(cp_model.LinearExpr.Sum(expr) <= 1)

    # Formation constraint
    # if input.PLAYERS_IN_POSITIONS == True:
    #     formation_list = input.formation_dict[input.FORMATION]
    #     cnt = {}
    #     for pos in formation_list:
    #         cnt[pos] = formation_list.count(pos)
    #     for pos, num in cnt.items():
    #         expr = players_grouped["possiblePositions"].get(
    #             map_idx["possiblePositions"][pos], [])
    #         model.Add(cp_model.LinearExpr.Sum(expr) == num)
    return model


@runtime
def create_nationId_constraint(df, model, player, map_idx, players_grouped, num_cnts,NUM_nationId, NATIONS):
    '''Create nationId constraint (>=)'''
    print(players_grouped)
    for i, nation_list in enumerate(NATIONS):
        expr = []
        for nation in nation_list:
            try:
                expr += players_grouped["nationId"].get(map_idx["nationId"][nation], [])
            except Exception as error:
                print("An exception occurred:", error)  
        model.Add(cp_model.LinearExpr.Sum(expr) >= NUM_nationId[i])
    return model


@runtime

def create_leagueId_constraint(df, model, player, map_idx, players_grouped, num_cnts, NUM_leagueId, LEAGUES):
    '''Create leagueId constraint (>=)'''
    for i, leagueId_list in enumerate(LEAGUES):
        expr = []
        for leagueId in leagueId_list:
            try:
                expr += players_grouped["leagueId"].get(map_idx["leagueId"][leagueId], [])
            except Exception as error:
                print("An exception occurred:", error)
        model.Add(cp_model.LinearExpr.Sum(expr) >= NUM_leagueId[i])
    return model


@runtime
def create_teamId_constraint(df, model, player, map_idx, players_grouped, num_cnts,NUM_teamId, TEAMS):
    '''Create teamId constraint (>=)'''
    for i, teamId_list in enumerate(TEAMS):
        expr = []
        for teamId in teamId_list:
            try:
                expr += players_grouped["teamId"].get(map_idx["teamId"][teamId], [])
            except Exception as error:
                print("An exception occurred:", error)
        model.Add(cp_model.LinearExpr.Sum(expr) >= NUM_teamId[i])
    return model

@runtime
def create_rarity_group_constraint(df, model, player, map_idx, players_grouped, num_cnts, NUM_RARITY_GROUP,RARITY_GROUPS):
    '''Create rarity group constraint (>=)'''
    for i, groupId_list in enumerate(RARITY_GROUPS):
        expr = []
        for groupId in groupId_list:
            expr += players_grouped["groups"].get(
                map_idx["groups"][groupId], [])
        model.Add(cp_model.LinearExpr.Sum(expr) >= NUM_RARITY_GROUP[i])
    return model


@runtime
def create_rarity_constraint(df, model, player, map_idx, players_grouped, num_cnts, NUM_RARITY,RARITIES):
    '''Create rarity constraint (>=)'''
    
    for i, groupId_list in enumerate(RARITIES):
        expr = []
        for groupId in groupId_list:
            try:
                expr += players_grouped["rarityId"].get(
                map_idx["rarityId"][groupId], [])
            except Exception as error:
                print("An exception occurred:", error)
        model.Add(cp_model.LinearExpr.Sum(expr) >= NUM_RARITY[i])
    
    return model


# @runtime
# def create_rarity_1_constraint(df, model, player, map_idx, players_grouped, num_cnts):
#     '''Create constraint for gold TOTW, gold Rare, gold Non Rare,
#        silver TOTW, etc (>=).
#     '''
#     for i, rarity in enumerate(input.RARITY_1):
#         idxes = list(df[(df["ratingTier"] == rarity[0]) &
#                      (df["rarityId"] == rarity[1])].index)
#         expr = [player[j] for j in idxes]
#         model.Add(cp_model.LinearExpr.Sum(expr) >= input.NUM_RARITY_1[i])
#     return model


# @runtime
# def create_rarity_2_constraint(df, model, player, map_idx, players_grouped, num_cnts):
#     '''[Rare, Common, TOTW, Gold, Silver, Bronze ... etc] (>=).'''
#     for i, rarity_type in enumerate(input.RARITY_2):
#         expr = []
#         if rarity_type in ["Gold", "Silver", "Bronze"]:
#             expr = players_grouped["ratingTier"].get(
#                 map_idx["ratingTier"].get(rarity_type, -1), [])
#         elif rarity_type == "Rare":
#             # Consider the following cards as Rare.
#             for col, rarity_list in input.CONSIDER_AS_RARE.items():
#                 for rarity in rarity_list:
#                     if col == 'Row_ID':
#                         expr += player[int(rarity) - 2]
#                     else:
#                         expr += players_grouped[col].get(
#                             map_idx[col].get(rarity, -1), [])
#         else:
#             expr = players_grouped["rarityId"].get(
#                 map_idx["rarityId"].get(rarity_type, -1), [])
#         model.Add(cp_model.LinearExpr.Sum(expr) >= input.NUM_RARITY_2[i])
#     return model


@runtime
def create_squad_rating_constraint_1(df, model, player, map_idx, players_grouped, num_cnts, SQUAD_RATING, NUM_PLAYERS):
    '''Squad rating: Min XX (>=) based on average rating.'''
    rating = df["rating"].tolist()
    model.Add(cp_model.LinearExpr.WeightedSum(player, rating)
              >= (SQUAD_RATING) * (NUM_PLAYERS))
    return model


@runtime
def create_squad_rating_constraint_2(df, model, player, map_idx, players_grouped, num_cnts, NUM_PLAYERS, SQUAD_RATING):
    '''Squad rating: Min XX (>=) based on
    https://www.reddit.com/r/EASportsFC/comments/5osq7k/new_overall_rating_figured_out.
    Probably more accurate.
    '''
    num_players = num_cnts[0]
    rating = df["rating"].tolist()
    # Assuming that the original ratings have been scaled by 11 (NUM_PLAYERS).
    avg_rat = cp_model.LinearExpr.WeightedSum(player, rating)
    # This represents the max non-negative gap between player rating and squad avg_rating.
    # Should be set to a reasonable amount to avoid overwhelming the solver.
    # Good solutions likely don't have large gap anyways.
    # max_rat * 11 - (min_rat * 10 + max_rat) (seems alright).
    max_gap_bw_rating = min(
        150, (df["rating"].max() - df["rating"].min()) * (NUM_PLAYERS - 1))
    excess = [model.NewIntVar(0, max_gap_bw_rating,
                              f"excess{i}") for i in range(num_players)]
    [model.AddMaxEquality(excess[i], [(
        player[i] * rat * NUM_PLAYERS - avg_rat), 0]) for i, rat in enumerate(rating)]
    sum_excess = cp_model.LinearExpr.Sum(excess)
    model.Add((avg_rat * NUM_PLAYERS + sum_excess) >=
              (SQUAD_RATING) * (NUM_PLAYERS) * (NUM_PLAYERS))
    return model


@runtime
def create_squad_rating_constraint_3(df, model, player, map_idx, players_grouped, num_cnts, NUM_PLAYERS, SQUAD_RATING):
    '''Squad rating: Min XX (>=).
    Another way to model 'create_squad_rating_constraint_2'.
    This significantly speeds up the model creation time and for some reason
    the solver converges noticeably faster to a good solution, even without a rating filter
    when tested on a single constraint like Squad rating: Min XX.
    '''
    rat_list = df["rating"].unique().tolist()
    # This variable represents how many players have a particular rating in the final solution.
    R = {}
    rat_expr = []
    for rat in (rat_list):
        rat_idx = map_idx["rating"][rat]
        expr = players_grouped["rating"].get(rat_idx, [])
        R[rat_idx] = model.NewIntVar(0, NUM_PLAYERS, f"R{rat_idx}")
        rat_expr.append(R[rat_idx] * rat)
        model.Add(R[rat_idx] == cp_model.LinearExpr.Sum(expr))
    avg_rat = cp_model.LinearExpr.Sum(rat_expr)
    # This is similar in concept to the excess variable in create_squad_rating_constraint_2.
    excess = [model.NewIntVar(0, 1500, f"excess{i}")
              for i in range(len(rat_list))]
    for rat in (rat_list):
        rat_idx = map_idx["rating"][rat]
        lhs = rat * NUM_PLAYERS * R[rat_idx]
        rat_expr_1 = []
        for rat_1 in (rat_list):
            rat_idx_1 = map_idx["rating"][rat_1]
            temp = model.NewIntVar(0, 15000, f"temp{rat_idx_1}")
            model.AddMultiplicationEquality(
                temp, R[rat_idx], R[rat_idx_1] * rat_1)
            rat_expr_1.append(temp)
        rhs = cp_model.LinearExpr.Sum(rat_expr_1)
        model.AddMaxEquality(excess[rat_idx], [lhs - rhs, 0])
    sum_excess = cp_model.LinearExpr.Sum(excess)
    model.Add((avg_rat * NUM_PLAYERS + sum_excess) >=
              (SQUAD_RATING) * (NUM_PLAYERS) * (NUM_PLAYERS))
    return model


@runtime
def create_min_overall_constraint(df, model, player, map_idx, players_grouped, num_cnts,  NUM_MIN_OVERALL, MIN_OVERALL):
    '''Minimum OVR of XX : Min X (>=)'''
    MAX_rating = df["rating"].max()
    for i, rating in enumerate(MIN_OVERALL):
        expr = []
        for rat in range(rating, MAX_rating + 1):
            if rat not in map_idx["rating"]:
                continue
            expr += players_grouped["rating"].get(map_idx["rating"][rat], [])
        model.Add(cp_model.LinearExpr.Sum(expr) >= NUM_MIN_OVERALL[i])
    return model


@runtime
def create_chemistry_constraint(df, model, chem, z_teamId, z_leagueId, z_nation, player, players_grouped, num_cnts, map_idx, b_c, b_l, b_n , formation, CHEMISTRY, CHEM_PER_PLAYER, NUM_PLAYERS):
    '''Optimize Chemistry (>=)
    (https://www.rockpapershotgun.com/fifa-23-chemistry)
    '''
    num_players, num_teamIds, num_leagueId, num_nationId = num_cnts[
        0], num_cnts[1], num_cnts[2], num_cnts[3]

    teamId_dict, leagueId_dict, nationId_dict, pos_dict = map_idx[
        "teamId"], map_idx["leagueId"], map_idx["nationId"], map_idx["possiblePositions"]

    formation_list = formation

    pos = []  # pos[i] = 1 => player[i] should be placed in their possiblePositions.
    m_pos, m_idx = {}, {}
    chem_expr = []

    for i in range(num_players):
        p_teamId, p_leagueId, p_nation, p_pos = df.at[i, "teamId"], df.at[i,"leagueId"], df.at[i, "nationId"], df.at[i, "possiblePositions"]
        pos.append(model.NewBoolVar(f"_pos{i}"))
        m_pos[player[i]] = pos[i]
        m_idx[player[i]] = i
        if p_pos in formation_list:
            if df.at[i, "teamId"] in ["ICON", "HERO"]:
                model.Add(chem[i] == 3)
            else:
                sum_expr = z_teamId[teamId_dict[p_teamId]] + \
                    z_leagueId[leagueId_dict[p_leagueId]] + \
                    z_nation[nationId_dict[p_nation]]
                b = model.NewBoolVar(f"b{i}")
                model.Add(sum_expr <= 3).OnlyEnforceIf(b)
                model.Add(sum_expr > 3).OnlyEnforceIf(b.Not())
                model.Add(chem[i] == sum_expr).OnlyEnforceIf(b)
                model.Add(chem[i] == 3).OnlyEnforceIf(b.Not())
        else:
            model.Add(chem[i] == 0)
            model.Add(pos[i] == 0)

        model.Add(chem[i] >= CHEM_PER_PLAYER).OnlyEnforceIf(player[i])
        play_pos = model.NewBoolVar(f"play_pos{i}")
        model.AddMultiplicationEquality(play_pos, player[i], pos[i])
        player_chem_expr = model.NewIntVar(0, 3, f"chem_expr{i}")
        model.AddMultiplicationEquality(player_chem_expr, play_pos, chem[i])
        chem_expr.append(player_chem_expr)

    pos_expr = []  # Players whose possiblePositions is there in the input formation.

    '''
        For example say if the solver selects 3 CMs in the final
        solution but we only need at-most 2 of them to be in possiblePositions for a 3-4-3
        formation and be considered for chemistry calcuation.
    '''
    for Pos in set(formation_list):
        if Pos not in pos_dict:
            continue
        t_expr = players_grouped["possiblePositions"].get(pos_dict[Pos], [])
        pos_expr += t_expr
        
        play_pos = [model.NewBoolVar(
            f"play_pos{Pos}{i}") for i in range(len(t_expr))]
        [model.AddMultiplicationEquality(
            play_pos[i], p, m_pos[p]) for i, p in enumerate(t_expr)]
        model.Add(cp_model.LinearExpr.Sum(play_pos)
                    <= formation_list.count(Pos))

    teamId_bucket = [[0, 1], [2, 3], [4, 6], [7, NUM_PLAYERS]]

    for j in range(num_teamIds):
        t_expr = players_grouped["teamId"].get(j, [])
        # We need players from j^th teamId whose possiblePositions is there in the input formation.
        # Since only such players would contribute towards chemistry.
        t_expr_1 = list(set(t_expr) & set(pos_expr))
        expr = []
        for i, p in enumerate(t_expr_1):
            # Heroes or Icons don't contribute to teamId chem.
            if df.at[m_idx[p], "teamId"] in ["ICON", "HERO"]:
                continue
            t_var = model.NewBoolVar(f"t_var_c{i}")
            model.AddMultiplicationEquality(t_var, p, m_pos[p])
            expr.append(t_var)
        sum_expr = cp_model.LinearExpr.Sum(expr)
        for idx in range(4):
            lb, ub = teamId_bucket[idx][0], teamId_bucket[idx][1]
            model.AddLinearConstraint(
                sum_expr, lb, ub).OnlyEnforceIf(b_c[j][idx])
            model.Add(z_teamId[j] == idx).OnlyEnforceIf(b_c[j][idx])
        model.AddExactlyOne(b_c[j])

    leagueId_bucket = [[0, 2], [3, 4], [5, 7], [8, NUM_PLAYERS]]

    icons_expr = players_grouped["teamId"].get(teamId_dict.get("ICON", -1), [])

    for j in range(num_leagueId):
        t_expr = players_grouped["leagueId"].get(j, [])
        # In EA FC 24, Icons add 1 chem to every leagueId in the squad.
        t_expr += icons_expr
        # We need players from j^th leagueId whose possiblePositions is there in the input formation.
        # Since only such players would contribute towards chemistry.
        t_expr_1 = list(set(t_expr) & set(pos_expr))
        expr = []
        for i, p in enumerate(t_expr_1):
            t_var = model.NewBoolVar(f"t_var_l{i}")
            model.AddMultiplicationEquality(t_var, p, m_pos[p])
            # Heroes contribute 2x to leagueId chem.
            if df.at[m_idx[p], "teamId"] == "HERO":
                expr.append(2 * t_var)
            else:
                expr.append(t_var)
        sum_expr = cp_model.LinearExpr.Sum(expr)
        for idx in range(4):
            lb, ub = leagueId_bucket[idx][0], leagueId_bucket[idx][1]
            model.AddLinearConstraint(
                sum_expr, lb, ub).OnlyEnforceIf(b_l[j][idx])
            model.Add(z_leagueId[j] == idx).OnlyEnforceIf(b_l[j][idx])
        model.AddExactlyOne(b_l[j])

    nationId_bucket = [[0, 1], [2, 4], [5, 7], [8, NUM_PLAYERS]]

    for j in range(num_nationId):
        t_expr = players_grouped["nationId"].get(j, [])
        # We need players from j^th nationId whose possiblePositions is there in the input formation.
        # Since only such players would contribute towards chemistry.
        t_expr_1 = list(set(t_expr) & set(pos_expr))
        expr = []
        for i, p in enumerate(t_expr_1):
            t_var = model.NewBoolVar(f"t_var_n{i}")
            model.AddMultiplicationEquality(t_var, p, m_pos[p])
            # Icons contribute 2x to nationId chem.
            if df.at[m_idx[p], "teamId"] == "ICON":
                expr.append(2 * t_var)
            else:
                expr.append(t_var)
        sum_expr = cp_model.LinearExpr.Sum(expr)
        for idx in range(4):
            lb, ub = nationId_bucket[idx][0], nationId_bucket[idx][1]
            model.AddLinearConstraint(
                sum_expr, lb, ub).OnlyEnforceIf(b_n[j][idx])
            model.Add(z_nation[j] == idx).OnlyEnforceIf(b_n[j][idx])
        model.AddExactlyOne(b_n[j])

    model.Add(cp_model.LinearExpr.Sum(chem_expr) >= CHEMISTRY)
    return model, pos, chem_expr


@runtime
def create_max_teamId_constraint(df, model, player, map_idx, players_grouped, num_cnts, MAX_NUM_teamId):
    '''Same teamId Count: Max X / Max X Players from the Same teamId (<=)'''
    num_teamIds = num_cnts[1]
    for i in range(num_teamIds):
        expr = players_grouped["teamId"].get(i, [])
        model.Add(cp_model.LinearExpr.Sum(expr) <= MAX_NUM_teamId)
    return model


@runtime
def create_max_leagueId_constraint(df, model, player, map_idx, players_grouped, num_cnts, MAX_NUM_leagueId):
    '''Same leagueId Count: Max X / Max X Players from the Same leagueId (<=)'''
    num_leagueId = num_cnts[2]
    for i in range(num_leagueId):
        expr = players_grouped["leagueId"].get(i, [])
        model.Add(cp_model.LinearExpr.Sum(expr) <= MAX_NUM_leagueId)
    return model


@runtime
def create_max_nationId_constraint(df, model, player, map_idx, players_grouped, num_cnts, MAX_NUM_nationId):
    '''Same Nation Count: Max X / Max X Players from the Same Nation (<=)'''
    num_nationId = num_cnts[3]
    for i in range(num_nationId):
        expr = players_grouped["nationId"].get(i, [])
        model.Add(cp_model.LinearExpr.Sum(expr) <= MAX_NUM_nationId)
    return model


@runtime
def create_min_teamId_constraint(df, model, player, map_idx, players_grouped, num_cnts, MIN_NUM_teamId):
    '''Same teamId Count: Min X / Min X Players from the Same teamId (>=)'''
    num_teamIds = num_cnts[1]
    B_C = [model.NewBoolVar(f"B_C{i}") for i in range(num_teamIds)]
    for i in range(num_teamIds):
        expr = players_grouped["teamId"].get(i, [])
        model.Add(cp_model.LinearExpr.Sum(expr) >=
                  MIN_NUM_teamId).OnlyEnforceIf(B_C[i])
        model.Add(cp_model.LinearExpr.Sum(expr) <
                  MIN_NUM_teamId).OnlyEnforceIf(B_C[i].Not())
    model.AddAtLeastOne(B_C)
    return model


@runtime
def create_min_leagueId_constraint(df, model, player, map_idx, players_grouped, num_cnts, MIN_NUM_leagueId):
    '''Same leagueId Count: Min X / Min X Players from the Same leagueId (>=)'''
    num_leagueId = num_cnts[2]
    B_L = [model.NewBoolVar(f"B_L{i}") for i in range(num_leagueId)]
    for i in range(num_leagueId):
        expr = players_grouped["leagueId"].get(i, [])
        model.Add(cp_model.LinearExpr.Sum(expr) >=
                  MIN_NUM_leagueId).OnlyEnforceIf(B_L[i])
        model.Add(cp_model.LinearExpr.Sum(expr) <
                  MIN_NUM_leagueId).OnlyEnforceIf(B_L[i].Not())
    model.AddAtLeastOne(B_L)
    return model


@runtime
def create_min_nationId_constraint(df, model, player, map_idx, players_grouped, num_cnts, MIN_NUM_nationId):
    '''Same Nation Count: Min X / Min X Players from the Same Nation (>=)'''
    num_nationId = num_cnts[3]
    B_N = [model.NewBoolVar(f"B_N{i}") for i in range(num_nationId)]
    for i in range(num_nationId):
        expr = players_grouped["nationId"].get(i, [])
        model.Add(cp_model.LinearExpr.Sum(expr) >=
                  MIN_NUM_nationId).OnlyEnforceIf(B_N[i])
        model.Add(cp_model.LinearExpr.Sum(expr) <
                  MIN_NUM_nationId).OnlyEnforceIf(B_N[i].Not())
    model.AddAtLeastOne(B_N)
    return model


@runtime
def create_unique_teamId_constraint(df, model, player, teamId, map_idx, players_grouped, num_cnts, NUM_UNIQUE_teamId):
    '''teamIds: Max / Min / Exactly X'''
    num_teamIds = num_cnts[1]
    for i in range(num_teamIds):
        expr = players_grouped["teamId"].get(i, [])
        model.Add(cp_model.LinearExpr.Sum(expr) >= 1).OnlyEnforceIf(teamId[i])
        model.Add(cp_model.LinearExpr.Sum(expr) ==
                  0).OnlyEnforceIf(teamId[i].Not())
    if NUM_UNIQUE_teamId[1] == "GREATER":
        model.Add(cp_model.LinearExpr.Sum(teamId) >= NUM_UNIQUE_teamId[0])
    elif NUM_UNIQUE_teamId[1] == "LOWER":
        model.Add(cp_model.LinearExpr.Sum(teamId) <= NUM_UNIQUE_teamId[0])
    elif NUM_UNIQUE_teamId[1] == "EXACT":
        model.Add(cp_model.LinearExpr.Sum(teamId) == NUM_UNIQUE_teamId[0])
    else:
        print("**Couldn't create unique_teamId_constraint!**")
    return model


@runtime
def create_unique_leagueId_constraint(df, model, player, leagueId, map_idx, players_grouped, num_cnts, NUM_UNIQUE_leagueId):
    '''leagueIds: Max / Min / Exactly X'''

    num_leagueId = num_cnts[2]
    
    for i in range(num_leagueId):
        expr = players_grouped["leagueId"].get(i, [])
        model.Add(cp_model.LinearExpr.Sum(expr) >= 1).OnlyEnforceIf(leagueId[i])
        model.Add(cp_model.LinearExpr.Sum(expr) ==
                  0).OnlyEnforceIf(leagueId[i].Not())
    if NUM_UNIQUE_leagueId[1] == "GREATER":
        model.Add(cp_model.LinearExpr.Sum(leagueId)
                  >= NUM_UNIQUE_leagueId[0])
    elif NUM_UNIQUE_leagueId[1] == "LOWER":
        model.Add(cp_model.LinearExpr.Sum(leagueId)
                  <= NUM_UNIQUE_leagueId[0])
    elif NUM_UNIQUE_leagueId[1] == "EXACT":
        model.Add(cp_model.LinearExpr.Sum(leagueId)
                  == NUM_UNIQUE_leagueId[0])
    else:
        print("**Couldn't create unique_leagueId_constraint!**")
    return model


@runtime
def create_unique_nationId_constraint(df, model, player, nationId, map_idx, players_grouped, num_cnts, NUM_UNIQUE_nationId):
    '''Nations: Max / Min / Exactly X'''
    num_nationId = num_cnts[3]
    for i in range(num_nationId):
        expr = players_grouped["nationId"].get(i, [])
        model.Add(cp_model.LinearExpr.Sum(expr) >= 1).OnlyEnforceIf(nationId[i])
        model.Add(cp_model.LinearExpr.Sum(expr) ==
                  0).OnlyEnforceIf(nationId[i].Not())
    if NUM_UNIQUE_nationId[1] == "GREATER":
        model.Add(cp_model.LinearExpr.Sum(nationId)
                  >= NUM_UNIQUE_nationId[0])
    elif NUM_UNIQUE_nationId[1] == "LOWER":
        model.Add(cp_model.LinearExpr.Sum(nationId)
                  <= NUM_UNIQUE_nationId[0])
    elif NUM_UNIQUE_nationId[1] == "EXACT":
        model.Add(cp_model.LinearExpr.Sum(nationId)
                  == NUM_UNIQUE_nationId[0])
    else:
        print("**Couldn't create unique_nationId_constraint!**")
    return model


@runtime
def prioritize_duplicates(df, model, player,NUM_PLAYERS):
    dup_idxes = list(df[(df["IsDuplicate"] == True)].index)
    if not dup_idxes:
        print("**No Duplicates Found!**")
        return model
    duplicates = [player[j] for j in dup_idxes]
    dup_expr = cp_model.LinearExpr.Sum(duplicates)
    if input.USE_ALL_DUPLICATES:
        model.Add(dup_expr == min(NUM_PLAYERS, len(dup_idxes)))
    elif input.USE_AT_LEAST_HALF_DUPLICATES:
        model.Add(2 * dup_expr >= min(NUM_PLAYERS, len(dup_idxes)))
    elif input.USE_AT_LEAST_ONE_DUPLICATE:
        model.Add(dup_expr >= 1)
    return model


@runtime
def fix_players(df, model, player):
    '''Fix specific players and optimize the rest'''
    if not input.FIX_PLAYERS:
        return model
    missing_players = []
    for idx in input.FIX_PLAYERS:
        idxes = list(df[(df["Original_Idx"] == (idx - 2))].index)
        if not idxes:
            missing_players.append(idx)
            continue
        players_to_fix = [player[j] for j in idxes]
        # Note: A selected player may play in multiple possiblePositionss.
        # Any one such version must be fixed.
        model.Add(cp_model.LinearExpr.Sum(players_to_fix) == 1)
    if missing_players:
        print(
            f"**Couldn't fix the following players with Row_ID: {missing_players}**")
        print(f"**They may have already been filtered out**")
    return model

MINIMIZE_MAX_COST=True
MAXIMIZE_TOTAL_COST=False
@runtime
def set_objective(df, model, player):
    '''Set objective based on player cost.
    The default behaviour of the solver is to minimize the overall cost.
    '''
    cost = df["price"].tolist()
    if input.MINIMIZE_MAX_COST:
        print("**MINIMIZE_MAX_COST**")
        max_cost = model.NewIntVar(0, df["price"].max(), "max_cost")
        play_cost = [player[i] * cost[i] for i in range(len(cost))]
        model.AddMaxEquality(max_cost, play_cost)
        model.Minimize(max_cost)
    elif input.MAXIMIZE_TOTAL_COST:
        print("**MAXIMIZE_TOTAL_COST**")
        model.Maximize(cp_model.LinearExpr.WeightedSum(player, cost))
    else:
        print("**MINIMIZE_TOTAL_COST**")
        model.Minimize(cp_model.LinearExpr.WeightedSum(player, cost))
    return model


def get_dict(df, col):
    '''Map fields to a unique index'''
    d = {}
    unique_col = df[col].unique()
    for i, val in enumerate(unique_col):
        d[val] = i
    return d


@runtime
def SBC(df,sbc):


    '''Optimize SBC using Constraint Integer Programming'''
    num_cnts = [df.shape[0], df.teamId.nunique(), df.leagueId.nunique(
    ), df.nationId.nunique()]  # Count of important fields
    map_idx = {}  # Map fields to a unique index
    fields = ["teamId", "leagueId", "nationId", "possiblePositions",
              "rating", "ratingTier", "groups","rarityId", "name"]
    for field in fields:
        map_idx[field] = get_dict(df, field)
    print('2')
    '''Create the CP-SAT Model'''
    model = cp_model.CpModel()

    '''Create essential variables and do some pre-processing'''
   
    model, player, chem, z_teamId, z_leagueId, z_nation, b_c, b_l, b_n, teamId, nationId, leagueId, players_grouped = create_var(
        model, df, map_idx, num_cnts)
    
    '''Essential constraints'''
    NUM_PLAYERS = 11-len(sbc['brickIndices'])
    model = create_basic_constraints(
        df, model, player, map_idx, players_grouped, num_cnts, NUM_PLAYERS)

    '''Comment out the constraints not required'''
    CHEMISTRY=0
    CHEM_PER_PLAYER=0
    
   
    for req in sbc['constraints']:
        print('Adding Constraint for ', req)
        if req['requirementKey']=='CHEMISTRY_POINTS':
            CHEMISTRY=req['eligibilityValues'][0]
        if req['requirementKey'] == 'ALL_PLAYERS_CHEMISTRY_POINTS':
            CHEM_PER_PLAYER = req['eligibilityValues'][0]

        if req['requirementKey']=='SAME_LEAGUE_COUNT':
            if req['scope']== 'LOWER' or req['scope']=='EXACT':
               model = create_max_leagueId_constraint(df, model, player, map_idx, players_grouped, num_cnts, req['eligibilityValues'][0])

            if req['scope']=='GREATER' or req['scope']=='EXACT':
                model = create_min_leagueId_constraint(df, model, player, map_idx, players_grouped, num_cnts, req['eligibilityValues'][0])
        
        if req['requirementKey']=='SAME_NATION_COUNT':
            if req['scope']== 'LOWER' or req['scope']=='EXACT':
                model = create_max_nationId_constraint(df, model, player, map_idx, players_grouped, num_cnts, req['eligibilityValues'][0])
            if req['scope']=='GREATER' or req['scope']=='EXACT':
               model = create_min_nationId_constraint(df, model, player, map_idx, players_grouped, num_cnts, req['eligibilityValues'][0])

        if req['requirementKey']=='SAME_CLUB_COUNT':
            if req['scope']== 'LOWER' or req['scope']=='EXACT':
                model = create_max_teamId_constraint(df, model, player, map_idx, players_grouped, num_cnts, req['eligibilityValues'][0])
            if req['scope']=='GREATER' or req['scope']=='EXACT':
               model = create_min_teamId_constraint(df, model, player, map_idx, players_grouped, num_cnts, req['eligibilityValues'][0])       
        
        if req['requirementKey']=='NATION_COUNT':
            model = create_unique_nationId_constraint(df, model, player, nationId, map_idx, players_grouped, num_cnts, [req['eligibilityValues'][0],req['scope']])
        if req['requirementKey']=='LEAGUE_COUNT': 
            model = create_unique_leagueId_constraint(df, model, player, leagueId, map_idx, players_grouped, num_cnts, [req['eligibilityValues'][0],req['scope']])    
        if req['requirementKey']=='CLUB_COUNT': 
            model = create_unique_teamId_constraint(df, model, player, teamId, map_idx, players_grouped, num_cnts, [req['eligibilityValues'][0],req['scope']])    

        if req['requirementKey']=='CLUB_ID': 
            model = create_teamId_constraint(df, model, player, map_idx, players_grouped, num_cnts, [req['count']], [req['eligibilityValues']])
        if req['requirementKey']=='LEAGUE_ID': 
            model = create_leagueId_constraint(df, model, player, map_idx, players_grouped, num_cnts, [req['count']], [req['eligibilityValues']])
        
        if req['requirementKey']=='NATION_ID': 
            model = create_nationId_constraint(df, model, player, map_idx, players_grouped, num_cnts, [req['count']], [req['eligibilityValues']])

        if req['requirementKey']=='PLAYER_RARITY_GROUP': 
            model = create_rarity_group_constraint(df, model, player, map_idx, players_grouped, num_cnts, [req['count']], [req['eligibilityValues']])
        if req['requirementKey']=='PLAYER_RARITY': 
            model = create_rarity_constraint(df, model, player, map_idx, players_grouped, num_cnts, [req['count']], [req['eligibilityValues']])
        if req['requirementKey'] == 'PLAYER_MIN_OVR':
            model = create_min_overall_constraint(df, model, player, map_idx, players_grouped, num_cnts, [
                                                  req['count']], [req['eligibilityValues'][0]]) 
        if req['requirementKey'] == 'TEAM_RATING':  
            model = create_squad_rating_constraint_3(
                df, model, player, map_idx, players_grouped, num_cnts, NUM_PLAYERS, req['eligibilityValues'][0])

    '''teamId'''
    # model = create_teamId_constraint(df, model, player, map_idx, players_grouped, num_cnts)
    # model = create_max_teamId_constraint(df, model, player, map_idx, players_grouped, num_cnts)
    # model = create_min_teamId_constraint(df, model, player, map_idx, players_grouped, num_cnts)
    # model = create_unique_teamId_constraint(df, model, player, teamId, map_idx, players_grouped, num_cnts)
    '''teamId'''

  

    '''rarityId'''
    # model = create_rarity_1_constraint(df, model, player, map_idx, players_grouped, num_cnts)
    
    '''rarityId'''

    '''Squad rating'''
    # model = create_squad_rating_constraint_1(df, model, player, map_idx, players_grouped, num_cnts)
    # model = create_squad_rating_constraint_2(df, model, player, map_idx, players_grouped, num_cnts)
  
    # model = create_squad_rating_constraint_3(df, model, player, map_idx, players_grouped, num_cnts)
    '''Squad rating'''

    '''Min Overall'''
    # model = create_min_overall_constraint(df, model, player, map_idx, players_grouped, num_cnts)
    '''Min Overall'''

    '''Duplicates'''
    # model = prioritize_duplicates(df, model, player)

    '''Comment out the constraints not required'''

    '''If there is no constraint on total chemistry, simply set CHEMISTRY = 0'''
    model, pos, chem_expr = create_chemistry_constraint(
        df, model, chem, z_teamId, z_leagueId, z_nation, player, players_grouped, num_cnts, map_idx, b_c, b_l, b_n, sbc['formation'], CHEMISTRY,CHEM_PER_PLAYER, NUM_PLAYERS)

    '''Fix specific players and optimize the rest'''
    # model = fix_players(df, model, player)

    '''Set objective based on player cost'''
    model = set_objective(df, model, player)

    '''Export Model to file'''
    # model.ExportToFile('model.txt')

    '''Solve'''
    print("Solve Started")
    solver = cp_model.CpSolver()

    '''Solver Parameters'''
    # solver.parameters.random_seed = 42
    # Whether the solver should log the search progress.
    solver.parameters.max_time_in_seconds = 120
    solver.parameters.log_search_progress = True
    # Specify the number of parallel workers (i.e. threads) to use during search.
    # This should usually be lower than your number of available cpus + hyperthread in your machine.
    # Setting this to 16 or 24 can help if the solver is slow in improving the bound.
    solver.parameters.num_search_workers = 16
    # Stop the search when the gap between the best feasible objective (O) and
    # our best objective bound (B) is smaller than a limit.
    # Relative: abs(O - B) / max(1, abs(O)).
    # Note that if the gap is reached, the search status will be OPTIMAL. But
    # one can check the best objective bound to see the actual gap.
    # solver.parameters.relative_gap_limit = 0.05
    # solver.parameters.cp_model_presolve = False
    # solver.parameters.stop_after_first_solution = True
    '''Solver Parameters'''
    status = solver.Solve(model, ObjectiveEarlyStopping(
        timer_limit=60))
    
    print('\n')
    final_players = []
    if status == 2 or status == 4:  # Feasible or Optimal
        df['Chemistry'] = 0
        # Is_Pos = 1 => Player should be placed in their respective possiblePositions.
        df['Is_Pos'] = 0
        for i in range(num_cnts[0]):
            if solver.Value(player[i]) == 1:
                final_players.append(i)
                df.loc[i, "Chemistry"] = solver.Value(chem_expr[i])
                df.loc[i, "Is_Pos"] = solver.Value(pos[i])
    return final_players,input.status_dict[status],status

