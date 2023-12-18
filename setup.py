import input
import optimize
import pandas as pd
from fastapi import Response



# Preprocess the club dataset obtained from https://chrome.google.com/webstore/detail/fut-enhancer/boffdonfioidojlcpmfnkngipappmcoh.
# Datset obtained from here has the extra columns [IsDuplicate, IsInActive11].
# So duplicates can be prioritized now if needed.
def preprocess_data(df: pd.DataFrame):
    # df = df.drop(['Price Limits', 'Last Sale Price', 'Discard Value', 'Contract', 'DefinitionId'], axis = 1)
    # df = df.rename(columns={'Nation': 'Country', 'Team' : 'Club', 'ExternalPrice': 'Cost'})

    # df = df[df["Color"] != "Gold"] # Can be used for constraints like Player Quality: Max Silver.
    # df = df[df["Color"] != "Bronze"] # Can be used for constraints like Player Quality: Min Silver.

    # Note: The filter on rating is especially useful when there is only a single constraint like Squad Rating: Min XX.
    # Otherwise, the search space is too large and this overwhelms the solver (very slow in improving the bound).
    # df = df[(df["Rating"] >= input.SQUAD_RATING - 3) & (df["Rating"] <= input.SQUAD_RATING + 3)]

    df = df.explode('possiblePositions')
    df = df.explode('groups')  # Creating separate entries of a particular player for each alternate position.
    df.to_csv("allPlayers.csv")
    df['Original_Idx'] = df.index
    df = df.reset_index(drop = True)

    return df






def runAutoSBC(sbc,players):
    print(sbc,players[0])
    df = pd.json_normalize(players)
    # dataset = "Real_Madrid_FC_24.csv"
    # df = pd.read_csv(dataset, index_col = False)
    # df = preprocess_data_1(df)
    
    # Remove All Players not matching quality first
    for req in sbc['constraints']:
        if req['requirementKey'] == 'PLAYER_QUALITY':
                if req['scope']=='GREATER' or req['scope']=='EXACT':
                    df = df[df["ratingTier"] >= req['eligibilityValues'][0]]
                if req['scope']=='LOWER' or req['scope']=='EXACT':
                    df = df[df["ratingTier"] <= req['eligibilityValues'][0]]

    df = preprocess_data(df)
  
    # df.to_excel("Club_Pre_Processed.xlsx", index = False)
    final_players,status,status_code = optimize.SBC(df,sbc)
    print(status)
    results=[]
    # if status != 2 and status != 4:
    #     return Response("{'status': {}, 'status_code': {}}".format(status, status_code), media_type="application/text")
    if final_players:
        df_out = df.iloc[final_players].copy()
        df_out.insert(5, 'Is_Pos', df_out.pop('Is_Pos'))
        print(f"Total Chemistry: {df_out['Chemistry'].sum()}")
        squad_rating = input.calc_squad_rating(df_out["rating"].tolist())
        print(f"Squad Rating: {squad_rating}")
        print(f"Total Cost: {df_out['price'].sum()}")
        df_out['Org_Row_ID'] = df_out['Original_Idx'] + 2
        df_out.pop('Original_Idx')
        results = df_out.to_json(orient="records")
    return Response(results, media_type="application/json")

