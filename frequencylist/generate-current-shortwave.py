from collections import defaultdict
import json
from datetime import datetime, timezone, time

def isNowInTimePeriod(startTime, endTime, nowTime): 
    if startTime < endTime: 
        return nowTime >= startTime and nowTime <= endTime 
    else: 
        #Over midnight: 
        return nowTime >= startTime or nowTime <= endTime 

numberOfDay = str(datetime.today().isoweekday())
#print("current ISO day of the week: ", numberOfDay)

utc_time = datetime.now(timezone.utc)
#print(utc_time.strftime('current UTC: %Y %m %d %H:%M:%S'))

broadcastersFile = open('broadcas.txt',encoding="ISO-8859-1")
frequenciesFile = open('0.TXT')


broadcasters = {}
for broadcaster in broadcastersFile:
    if broadcaster[0] != ';':
        k, v = broadcaster.rstrip().split(" ", 1)
        broadcasters[k] = v

frequencies = defaultdict(set)
for frequency in frequenciesFile:
    if frequency[0] != ';':
        f = int(frequency[:5]) #first 5 char as frequency
        b = frequency[117:120] #3 char shortname of station
        startTimeHour = int(frequency[6:8])
        startTimeMinute = int(frequency[8:10])
        endTimeHour = int(frequency[11:13])
        endTimeMinute = int(frequency[13:15])
        activeDays = frequency[72:79]
        #frequencies[f].add(b)
        print(f, b, 'start: ', startTimeHour, startTimeMinute, 'end: ', endTimeHour, endTimeMinute, 'days: ', activeDays, end=' ')

        if (activeDays.find(numberOfDay) > -1):
            if endTimeHour == 24:
                endTimeHour = 23
                endTimeMinute = 59
            if startTimeHour == 24:
                startTimeHour = 23
                startTimeMinute = 59
            DTstartTime = time(startTimeHour, startTimeMinute, 0, 0)
            DTendTime = time(endTimeHour, endTimeMinute, 0, 0)
            if isNowInTimePeriod(DTstartTime, DTendTime, utc_time.time()):
                frequencies[f].add(b)
                print('active')
            else:
                print('not active')
        else:
            print('not active')
for k in frequencies.keys():
    frequencies[k] = "\n".join(sorted(broadcasters[x] for x in frequencies[k]))

frequenciesSorted = []
for k, v in sorted(frequencies.items()):
    frequenciesSorted.append({"frequency": k*1000, "name": v, "mode": "AM"})

json.dump(frequenciesSorted, open('shortwavestations.json','w'), indent=4)

