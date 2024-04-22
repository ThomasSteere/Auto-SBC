
import optimize
import pandas as pd
from fastapi import Response
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
# Preprocess the club dataset obtained from api.

def preprocess_data(df: pd.DataFrame,sbc):
    df['price']= df['price'].fillna(15000000) #set price to 15m if missing so it will only use the player if really necessary
    expPP=False
    expPR=False
    for req in sbc['constraints']:
        if req['requirementKey'] == 'CHEMISTRY_POINTS' or req['requirementKey'] == 'ALL_PLAYERS_CHEMISTRY_POINTS':
            expPP=True        
        if req['requirementKey'] == 'PLAYER_RARITY_GROUP':
            expPR=True           
              # Creating separate entries of a particular player for each alternate position.
    if expPP:
        df = df.assign(possiblePositions=[[x for x in l if x in sbc['formation']] for l in df['possiblePositions']])
        df['possiblePositions'] = df['possiblePositions'].apply(lambda y: [99] if len(y)==0 else y)
        
        df = df.explode('possiblePositions')
    else:
        df = df.assign(possiblePositions=0)
    if expPR:
        df = df.explode('groups')
    else:
        df = df.assign(groups=0)
    df.to_csv("allPlayers.csv")
    df['Original_Idx'] = df.index
    df = df.reset_index(drop = True)

    return df


def runAutoSBC(sbc,players,maxSolveTime):
    print(sbc)
    df = pd.json_normalize(players)
    # Remove All Players not matching quality first
    df = df[df["price"] > 0]
    for req in sbc['constraints']:
        if req['requirementKey'] == 'PLAYER_QUALITY':
                if req['scope']=='GREATER' or req['scope']=='EXACT':
                    df = df[df["ratingTier"] >= req['eligibilityValues'][0]]
                if req['scope']=='LOWER' or req['scope']=='EXACT':
                    df = df[df["ratingTier"] <= req['eligibilityValues'][0]]

    df = preprocess_data(df,sbc)
    final_players,status,status_code = optimize.SBC(df,sbc,maxSolveTime)
    results=[]
    # if status != 2 and status != 4:
    #      return "{'status': {}, 'status_code': {}}".format(status, status_code)
    if final_players:
        df_out = df.iloc[final_players].copy()
        df_out.insert(5, 'Is_Pos', df_out.pop('Is_Pos'))
        print(f"Total Chemistry: {df_out['Chemistry'].sum()}")
        squad_rating = calc_squad_rating(df_out["rating"].tolist())
        print(f"Squad Rating: {squad_rating}")
        print(f"Total Cost: {df_out['price'].sum()}")
        df_out['Org_Row_ID'] = df_out['Original_Idx'] + 2
        df_out.pop('Original_Idx')
        print(sbc, status, status_code)
        results = df_out.to_json(orient="records")
        json_compatible_item_data = jsonable_encoder({'results':results,'status':status,'status_code':status_code})
        return JSONResponse(content=json_compatible_item_data)
    json_compatible_item_data = jsonable_encoder({'status':status,'status_code':status_code})
    return JSONResponse(content=json_compatible_item_data)



def calc_squad_rating(rating):
    '''https://www.reddit.com/r/EASportsFC/comments/5osq7k/new_overall_rating_figured_out'''
    rat_sum = sum(rating)
    avg_rat = rat_sum / 11
    excess = sum(max(rat - avg_rat, 0) for rat in rating)
    return round(avg_rat + excess)
