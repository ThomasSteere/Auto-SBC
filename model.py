from pydantic import BaseModel

class postData(BaseModel):
    name: str
    body: str

class Player(BaseModel):
    id: int
    assetId: int 
    name: str
    definitionId: int
    rating: int
    teamId:int
    leagueId:int
    nationId:int
    rarityId:int
    isUntradeable:bool
    isDuplicate:bool
    preferredPosition:int
    possiblePositions:list
    groups :list
    price: int

class SBC(BaseModel):
    id: int
    assetId: int 
    definitionId: int
    rating: int
    teamId:int
    leagueId:int
    nationId:int
    rarityId:int
    isUntradeable:bool
    preferredPosition:int
    possiblePositions:list
    groups :list
    price: int