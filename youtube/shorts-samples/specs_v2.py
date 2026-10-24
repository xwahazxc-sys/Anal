"""v2 of the nine samples: stronger hooks (scored with hookscore.py), digits in captions, strongest moving shot first,
three animated shots per Short, on-screen hook at 0.0 s."""
import copy
from specs import S as S1

S = copy.deepcopy(S1)

# per short: new first line(s), caption text with digits (same words count not required), shot order (indices into
# the v1 shots list), animated shots (indices in the NEW order), hook text on screen from 0.0 s
V2 = {
 "jet": dict(
   lines=["You could buy this jet tomorrow and still be broke in a year. Here's why.",
          "It costs around seventy million dollars. But just to keep it flying, owners spend about eleven thousand dollars for every hour in the air.",
          "Fly it four hundred and fifty hours a year, and that's around five million dollars.",
          "Pilots, fuel, the hangar, insurance. Every single year.",
          "The jet is the cheap part. Keeping it is the real price."],
   caps=["You could buy this jet tomorrow and still be broke in a year. Here's why.",
         "It costs around $70 million. But just to keep it flying, owners spend about $11,000 for every hour in the air.",
         "Fly it 450 hours a year, and that's around $5 million.",
         "Pilots, fuel, the hangar, insurance. Every single year.",
         "The jet is the cheap part. Keeping it is the real price."],
   order=[6, 0, 2, 3, 4, 1, 5], motion=[0, 2, 3],
   hook="BROKE IN 1 YEAR?", texts=[("$70,000,000", 1), ("$11,000 / HOUR", 1.5), ("~$5,000,000 / YEAR", 2)],
   mprompts=["the business jet climbs into the sunset sky, slow camera follow, cinematic",
             "the pilots flip switches and adjust the throttle, instrument lights flicker, cinematic",
             "fuel hose shakes as fuel flows, the truck engine vibrates, dusk light, cinematic"]),
 "fenrir": dict(order=[4, 0, 2, 3, 1, 5], motion=[0, 1, 2],
   hook="THE GODS CHAINED HIM", texts=[("THE GODS CHAINED HIM", 0), ("BIG MISTAKE.", 1.0), ("FENRIR", 4)],
   mprompts=["the giant wolf tears through the golden chains, chain links fly apart, lightning flashes, epic",
             "the chained black wolf pulls against the glowing golden chains, growling, sparks, epic",
             "the wolf's amber eye opens slowly and the pupil narrows, embers float, epic"]),
 "roommates": dict(
   lines=["You'd lose your security deposit in a week with these roommates.",
          "Germany already made a cleaning schedule. It's laminated.",
          "Italy is cooking pasta at two A.M. and arguing with the stove.",
          "Japan cleaned the whole bathroom. Nobody saw it happen.",
          "And Brazil invited forty people. On a Tuesday.",
          "Which roommate are you? Comment your country."],
   caps=["You'd lose your security deposit in a week with these roommates.",
         "Germany already made a cleaning schedule. It's laminated.",
         "Italy is cooking pasta at 2 AM and arguing with the stove.",
         "Japan cleaned the whole bathroom. Nobody saw it happen.",
         "And Brazil invited 40 people. On a Tuesday.",
         "Which roommate are you? Comment your country."],
   order=[4, 1, 2, 3, 0, 5], motion=[0, 2, 5], hook="COUNTRIES AS ROOMMATES", texts=[],
   mprompts=["the cartoon character dances happily at the party, confetti falls, pixar animation",
             "the cartoon character stirs the pasta pot angrily and waves the wooden spoon, steam rises, pixar animation",
             "the four cartoon characters on the sofa turn their heads and look at the camera, pixar animation"]),
 "gorilla": dict(
   lines=["A grizzly is almost twice the weight of a gorilla. So why do people still bet on the gorilla?",
          "The silverback: around two hundred kilos, insanely strong, and explosive in short bursts.",
          "The grizzly: up to three hundred and sixty kilos, claws up to ten centimeters long, and thick fur and fat like armor.",
          "Pound for pound, the gorilla is stronger. But weight and claws decide real fights.",
          "On paper, the grizzly wins. Team gorilla or team bear?"],
   caps=["A grizzly is almost twice the weight of a gorilla. So why do people still bet on the gorilla?",
         "The silverback: around 200 kg, insanely strong, and explosive in short bursts.",
         "The grizzly: up to 360 kg, claws up to 10 cm long, and thick fur and fat like armor.",
         "Pound for pound, the gorilla is stronger. But weight and claws decide real fights.",
         "On paper, the grizzly wins. Team gorilla or team bear?"],
   order=[4, 0, 2, 3, 1], motion=[0, 1, 2], hook="GORILLA vs GRIZZLY",
   texts=[("~200 KG", 1), ("~360 KG", 2)],
   mprompts=["the gorilla and the grizzly bear lunge toward each other, mist swirls, dramatic wildlife footage",
             "the silverback gorilla roars and beats its chest, mist drifts, wildlife footage",
             "the grizzly bear roars and swipes the air with its claws, wildlife footage"]),
 "truck": dict(order=[4, 0, 1, 2, 3], motion=[0, 2, 4],
   hook="DAY 1 vs DAY 90", texts=[("DAY 90", 0), ("DAY 1", 1), ("DAY 30", 2), ("DAY 60", 3), ("DAY 90", 4)],
   mprompts=["the black lifted truck drives toward the camera through the rainy neon street, headlights flare, cinematic",
             "sparks fly from the angle grinder across the rusty truck, mechanics move in the background, cinematic",
             "the lifted black truck's headlights switch on and the neon underglow pulses, cinematic"]),
 "gummy": dict(
   lines=["Every gummy bear you've ever eaten spent a whole night buried in cornstarch.",
          "Sugar, glucose syrup and water get cooked. Then gelatin, color and flavor go in.",
          "A machine called a starch mogul stamps thousands of tiny bear shapes into trays of cornstarch.",
          "The hot mix is poured in, and the bears rest overnight while the starch pulls out the moisture.",
          "Then they're shaken out, brushed, and lightly coated so they don't stick together."],
   order=[2, 0, 1, 3, 4], motion=[0, 1, 3], hook="BURIED OVERNIGHT?", texts=[],
   mprompts=["factory nozzles deposit bright red liquid candy into bear shaped cavities, macro, smooth",
             "golden syrup bubbles and swirls in the steel kettle, steam rises, macro",
             "colorful gummy bears tumble and roll inside the rotating steel drum, macro, smooth"]),
 "zeigarnik": dict(order=[3, 0, 1, 2, 4], motion=[0, 1, 4], hook="DON'T SCROLL YET",
   texts=[("ZEIGARNIK EFFECT", 1)],
   mprompts=["the person in bed turns over restlessly, phone light flickers on their face, night",
             "the floating browser windows around the glowing brain multiply and flicker, surreal",
             "the person hanging from the cliff edge slips and grabs tighter, dust falls, sunset"]),
 "autobahn": dict(
   lines=["In Deutschland darfst du auf der Autobahn so schnell fahren, wie du willst. Oder?",
          "Seit 1978 gibt es nur eine Empfehlung: 130 Kilometer pro Stunde. Die Richtgeschwindigkeit.",
          "Auf mehr als der Hälfte der Autobahnkilometer gibt es kein festes Limit.",
          "Aber Vorsicht: Wer deutlich schneller fährt und einen Unfall hat, kann eine Mitschuld bekommen, auch wenn der andere den Fehler gemacht hat.",
          "Wusstest du das?"],
   order=[1, 0, 2, 3, 4], motion=[0, 1, 4], hook="KEIN TEMPOLIMIT?",
   texts=[("130 = NUR EMPFEHLUNG", 1), ("SEIT 1978", 1.5)],
   mprompts=["the silver sports car speeds along the autobahn, camera tracking alongside, motion blur",
             "traffic flows on the curving autobahn seen from above, slow aerial drift, golden hour",
             "light trails stream along the dark autobahn, timelapse, night"]),
 "janitor": dict(
   lines=["They laughed at the janitor for six hours. It took him ten seconds.",
          "Three engineers couldn't start the engine. The test was in the morning.",
          "He listened for ten seconds. Then he tightened one bolt.",
          "The engine started on the first try.",
          "Nobody knew he had designed it. Thirty years ago."],
   caps=["They laughed at the janitor for 6 hours. It took him 10 seconds.",
         "Three engineers couldn't start the engine. The test was in the morning.",
         "He listened for 10 seconds. Then he tightened one bolt.",
         "The engine started on the first try.",
         "Nobody knew he had designed it. 30 years ago."],
   order=[4, 0, 1, 2, 3, 5], motion=[0, 4, 3], hook="6 HOURS vs 10 SECONDS", texts=[],
   mprompts=["the jet engine spins up with heat haze and a burst of flame, engineers step back covering their ears",
             "the old janitor slowly turns the wrench on the bolt, close-up, cinematic",
             "the old janitor leans closer to the engine with eyes closed, listening, slight head tilt, cinematic"]),
}

for n, v in V2.items():
    s = S[n]
    if "lines" in v:
        s["lines"] = v["lines"]
    s["caps"] = v.get("caps", s.get("lines"))
    s["shots"] = [S1[n]["shots"][i] for i in v["order"]]
    s["order"] = v["order"]
    s["motion"] = v["motion"]
    s["mprompts"] = v["mprompts"]
    s["hook"] = v["hook"]
    s["texts"] = v["texts"]
