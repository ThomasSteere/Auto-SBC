from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request, FastAPI
import setup
import json
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.post('/solve')
async def get_body(request: Request):
    requestData= await request.json()
    sbcData=requestData['sbcData']
    clubPlayers=requestData['clubPlayers']
    maxSolveTime=requestData['maxSolveTime']
    # solveSettings=requestData['solveSettings']
    return  setup.runAutoSBC(sbcData,clubPlayers,maxSolveTime)
    # setup.runAutoSBC(1,2)