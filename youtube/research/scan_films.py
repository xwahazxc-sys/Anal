#!/usr/bin/env python3
"""scan_films.py - candidate film list for the rights-management scan. Writes scan/films.json.

Each film: title, year, country, alternative (localized) titles, strict (generic title -> the
video title must also contain the year to count as a copy).
"""
import json, os
S = "strict"
F = [
# Brazil
("Tropa de Elite",2007,"BR",["Elite Squad","Tropa de élite"]),("Tropa de Elite 2",2010,"BR",["Elite Squad 2","Elite Squad: The Enemy Within"]),
("Cidade de Deus",2002,"BR",["City of God","Ciudad de Dios"]),("Meu Nome Não é Johnny",2008,"BR",[]),("Os Normais",2003,"BR",[]),
("Se Eu Fosse Você",2006,"BR",[]),("Se Eu Fosse Você 2",2009,"BR",[]),("De Pernas pro Ar",2010,"BR",[]),("Minha Mãe é uma Peça",2013,"BR",[]),
("Loucas pra Casar",2015,"BR",[]),("Vai que Cola: O Filme",2015,"BR",[]),("Os Dez Mandamentos: O Filme",2016,"BR",[]),("Nosso Lar",2010,"BR",["Astral City"]),
("Chico Xavier",2010,"BR",[]),("O Auto da Compadecida",2000,"BR",["A Dog's Will"]),("Lisbela e o Prisioneiro",2003,"BR",[]),("Carandiru",2003,"BR",[]),
("Bruna Surfistinha",2011,"BR",[]),("Faroeste Caboclo",2013,"BR",[]),("Somos Tão Jovens",2013,"BR",[]),("Tim Maia",2014,"BR",[],S),
("2 Filhos de Francisco",2005,"BR",["Dois Filhos de Francisco"]),("Xingu",2012,"BR",[],S),("Real: O Plano por Trás da História",2017,"BR",[]),
("Polícia Federal: A Lei é para Todos",2017,"BR",[]),("Nada a Perder",2018,"BR",[]),("Eduardo e Mônica",2022,"BR",[]),("Marighella",2019,"BR",[]),
("Bacurau",2019,"BR",[]),("O Palhaço",2011,"BR",[]),("Entre Abelhas",2015,"BR",[]),("Detetives do Prédio Azul",2017,"BR",[]),
("Carrossel: O Filme",2015,"BR",[]),("Turma da Mônica: Lições",2021,"BR",[]),("Os Saltimbancos Trapalhões: Rumo a Hollywood",2017,"BR",[]),
("Até que a Sorte nos Separe",2012,"BR",[]),("Assalto ao Banco Central",2011,"BR",[]),("Cine Holliúdy",2012,"BR",[]),("Tô Ryca",2016,"BR",[]),
("Turma da Mônica: Laços",2019,"BR",[]),("Morto Não Fala",2018,"BR",[]),
# Mexico
("Nosotros los Nobles",2013,"MX",["We Are the Nobles"]),("No se Aceptan Devoluciones",2013,"MX",["Instructions Not Included"]),
("Qué culpa tiene el niño",2016,"MX",[]),("Mirreyes contra Godínez",2019,"MX",[]),("Una Película de Huevos",2006,"MX",[]),
("Otra Película de Huevos y un Pollo",2009,"MX",[]),("Amores Perros",2000,"MX",[]),("El Crimen del Padre Amaro",2002,"MX",[]),
("La Dictadura Perfecta",2014,"MX",[]),("Rudo y Cursi",2008,"MX",[]),("Sexo, pudor y lágrimas",1999,"MX",[]),("Kilómetro 31",2006,"MX",["Km 31"]),
("Kilómetro 31-2",2016,"MX",["Km 31-2","Km 31 2"]),("Ladies' Night",2003,"MX",[],S),("Treintona, soltera y fantástica",2016,"MX",[]),
("Hazlo como hombre",2017,"MX",[]),("Güeros",2014,"MX",[]),("Belzebuth",2017,"MX",[]),("Ya veremos",2018,"MX",[]),
("La Leyenda de la Nahuala",2007,"MX",[]),("La Leyenda de la Llorona",2011,"MX",[]),("La jaula de oro",2013,"MX",[]),("Matando Cabos",2004,"MX",[]),
("Hasta el viento tiene miedo",1968,"MX",[]),("Un Dios prohibido",2013,"MX",["Mártires"]),
# Argentina
("El Secreto de sus Ojos",2009,"AR",["The Secret in Their Eyes","O Segredo dos Seus Olhos"]),("Relatos Salvajes",2014,"AR",["Wild Tales","Relatos Selvagens"]),
("Nueve Reinas",2000,"AR",["Nine Queens","Nove Rainhas"]),("El Clan",2015,"AR",[],S),("Elefante Blanco",2012,"AR",[]),("Carancho",2010,"AR",[]),
("El Robo del Siglo",2020,"AR",[]),("Nieve negra",2017,"AR",[]),("La Odisea de los Giles",2019,"AR",["Heroic Losers"]),("Kóblic",2016,"AR",[]),
("El Ciudadano Ilustre",2016,"AR",[]),("Un Novio para mi Mujer",2008,"AR",[]),("Aterrados",2017,"AR",["Terrified"]),
# Spain
("Ocho Apellidos Vascos",2014,"ES",["Spanish Affair"]),("Ocho Apellidos Catalanes",2015,"ES",[]),("Torrente",1998,"ES",[],S),("Campeones",2018,"ES",[],S),
("Perfectos Desconocidos",2017,"ES",[]),("Celda 211",2009,"ES",["Cell 211","Cela 211"]),("No Habrá Paz para los Malvados",2011,"ES",[]),
("La Isla Mínima",2014,"ES",["Marshland"]),("Tarde para la Ira",2016,"ES",[]),("El Niño",2014,"ES",[],S),("El Orfanato",2007,"ES",["The Orphanage","O Orfanato"]),
("REC",2007,"ES",["[REC]"],S),("Contratiempo",2016,"ES",["The Invisible Guest","Um Contratempo"]),("Los ojos de Julia",2010,"ES",["Julia's Eyes"]),
("Verónica",2017,"ES",[],S),("Que Dios nos perdone",2016,"ES",[]),("Toc Toc",2017,"ES",[]),("Tres metros sobre el cielo",2010,"ES",[]),
("Tengo ganas de ti",2012,"ES",[]),("Palmeras en la nieve",2015,"ES",[]),("Villaviciosa de al lado",2016,"ES",[]),("El cuerpo",2012,"ES",["The Body"],S),
# Colombia / Chile / Peru
("Sumas y Restas",2004,"CO",[]),("Rosario Tijeras",2005,"CO",[]),("El Paseo",2010,"CO",[],S),("Uno al año no hace daño",2014,"CO",[]),
("Asu Mare",2013,"PE",[]),("Machuca",2004,"CL",[]),("La Vendedora de Rosas",1998,"CO",[]),
# US faith / family / indie
("Fireproof",2008,"US",["A Prova de Fogo"]),("Courageous",2011,"US",["Corajosos","Reto de Valientes"]),("Facing the Giants",2006,"US",["Desafiando Gigantes"]),
("War Room",2015,"US",["Cuarto de Guerra","Quarto de Guerra"]),("Overcomer",2019,"US",["Mais que Vencedores","Más que Vencedores"]),
("God's Not Dead",2014,"US",["Deus Não Está Morto","Dios no está muerto"]),("Miracles from Heaven",2016,"US",["Milagros del cielo","Milagres do Paraíso"]),
("Heaven Is for Real",2014,"US",["El cielo sí existe","O Céu é de Verdade"]),("The Shack",2017,"US",["La Cabaña","A Cabana"],S),
("I Can Only Imagine",2018,"US",["Solo puedo imaginar"]),("Breakthrough",2019,"US",["Superação: O Milagre da Fé","Un Amor Inquebrantable"],S),
("Soul Surfer",2011,"US",["Coração de Surfista"]),("October Baby",2011,"US",[]),("Mom's Night Out",2014,"US",[]),("Do You Believe?",2015,"US",[],S),
("Unplanned",2019,"US",["Inesperado"],S),("The Case for Christ",2017,"US",["Em Defesa de Cristo"]),("Flywheel",2003,"US",[],S),("Grace Unplugged",2013,"US",[]),
("Indivisible",2018,"US",[],S),("Woodlawn",2015,"US",[]),("Run the Race",2018,"US",[]),
("Dolphin Tale",2011,"US",["Winter, o Golfinho","Winter, el delfín"]),("A Dog's Purpose",2017,"US",["Quatro Vidas de um Cachorro","La razón de estar contigo"]),
("Hachi: A Dog's Tale",2009,"US",["Sempre ao Seu Lado","Siempre a tu lado"]),("Marley & Me",2008,"US",["Marley e Eu","Marley y yo"]),
("Eight Below",2006,"US",["Resgate Abaixo de Zero","Bajo cero"]),("Snow Dogs",2002,"US",[]),("Air Bud",1997,"US",[]),("Beethoven",1992,"US",[],S),
("The Ultimate Gift",2006,"US",["O Presente"]),("Penelope",2006,"US",[],S),("Leap Year",2010,"US",["Casa Comigo?"],S),
# US/UK action, epic, horror
("Big Stan",2007,"US",[]),("Let's Go to Prison",2006,"US",[]),("Felon",2008,"US",[],S),("Snitch",2013,"US",[],S),("Black Death",2010,"UK",[],S),
("Ironclad",2011,"UK",[],S),("Outcast",2014,"US",[],S),("Centurion",2010,"UK",[],S),("The Eagle",2011,"UK",[],S),("Season of the Witch",2011,"US",[]),
("Solomon Kane",2009,"UK",[]),("Pathfinder",2007,"US",[],S),("Valhalla Rising",2009,"UK",[]),("Northmen: A Viking Saga",2014,"CH",["Northmen"]),
("The Last Legion",2007,"UK",[]),("Acts of Vengeance",2017,"US",[]),("12 Rounds",2009,"US",[]),("The Condemned",2007,"US",[],S),
("Blood and Bone",2009,"US",[]),("Undisputed II",2006,"US",["Undisputed 2"]),("Undisputed III",2010,"US",["Undisputed 3"]),("Ninja",2009,"US",[],S),
("Kickboxer: Vengeance",2016,"US",[]),("Universal Soldier: Regeneration",2009,"US",[]),
("The Lodgers",2017,"IE",[]),("The Taking of Deborah Logan",2014,"US",[]),("Lake Mungo",2008,"AU",[]),("Grave Encounters",2011,"CA",[]),
("The Possession of Hannah Grace",2018,"US",[]),("The Autopsy of Jane Doe",2016,"US",[]),("The Hallow",2015,"IE",[],S),("Oculus",2013,"US",[],S),
("The Pact",2012,"US",[],S),("Sinister",2012,"US",[],S),("The Boy",2016,"US",[],S),("The Bye Bye Man",2017,"US",[]),("Wish Upon",2017,"US",[]),
("The Gallows",2015,"US",[],S),("The Devil Inside",2012,"US",[]),("The Rite",2011,"US",[],S),("The Last Exorcism",2010,"US",[]),
("Deliver Us from Evil",2014,"US",[],S),
("Love, Rosie",2014,"UK",["Simplesmente Acontece","Los imprevistos del amor"]),("About Time",2013,"UK",["Questão de Tempo","Una cuestión de tiempo"]),
("The Lucky One",2012,"US",[],S),("Safe Haven",2013,"US",[],S),("The Best of Me",2014,"US",[],S),("The Longest Ride",2015,"US",[]),("Dear John",2010,"US",[],S),
("A Walk to Remember",2002,"US",["Um Amor para Recordar","Un amor para recordar"]),("Letters to Juliet",2010,"US",["Cartas para Julieta"]),
("Midnight Sun",2018,"US",[],S),("Everything, Everything",2017,"US",[]),("Five Feet Apart",2019,"US",[]),("The Choice",2016,"US",[],S),
("Chalet Girl",2011,"UK",[]),("The Decoy Bride",2011,"UK",[]),
("Gnome Alone",2017,"US",[]),("Rock Dog",2016,"US",[]),("Spark: A Space Tail",2016,"CA",[]),("Bilal: A New Breed of Hero",2015,"AE",["Bilal"]),
("Ribbit",2014,"MY",[],S),("Norm of the North",2016,"US",[]),("Arctic Dogs",2019,"US",[]),("Two by Two",2015,"DE",["Ooops! Noah Is Gone"]),
("Ozzy",2016,"ES",[],S),("Animal Crackers",2017,"US",[],S),("The Stolen Princess",2018,"UA",[]),
# UK / Australia
("Kill List",2011,"UK",[]),("Severance",2006,"UK",[],S),("Wild Bill",2011,"UK",[],S),("Attack the Block",2011,"UK",[]),("Eden Lake",2008,"UK",[]),
("The Descent",2005,"UK",[],S),("Dead Man's Shoes",2004,"UK",[]),("Harry Brown",2009,"UK",[]),("Green Street",2005,"UK",["Green Street Hooligans"]),
("Layer Cake",2004,"UK",[]),("Pride",2014,"UK",[],S),("Brassed Off",1996,"UK",[]),("Bend It Like Beckham",2002,"UK",[]),("Calendar Girls",2003,"UK",[],S),
("Wyrmwood",2014,"AU",[]),("Red Dog",2011,"AU",[],S),("Paper Planes",2014,"AU",[],S),("Wolf Creek",2005,"AU",[]),("The Loved Ones",2009,"AU",[],S),
("Animal Kingdom",2010,"AU",[],S),("Oddball",2015,"AU",[],S),("Storm Boy",2019,"AU",[],S),("Mao's Last Dancer",2009,"AU",[]),("The Dish",2000,"AU",[],S),
("Hounds of Love",2016,"AU",[]),("Killing Ground",2016,"AU",[]),("The Babadook",2014,"AU",[]),
# Korea
("Train to Busan",2016,"KR",["Tren a Busan","Invasão Zumbi"]),("The Wailing",2016,"KR",["El lamento","O Lamento"],S),
("Miracle in Cell No. 7",2013,"KR",["Miracle in Cell No 7"]),("Ode to My Father",2014,"KR",[]),("Veteran",2015,"KR",[],S),("The Outlaws",2017,"KR",[],S),
("A Hard Day",2014,"KR",[],S),("I Saw the Devil",2010,"KR",["Encontré al diablo","Eu Vi o Diabo"]),("The Chaser",2008,"KR",[],S),
("Midnight Runners",2017,"KR",[]),("Tunnel",2016,"KR",[],S),("The Man from Nowhere",2010,"KR",["O Homem de Lugar Nenhum"]),("New World",2013,"KR",[],S),
("Inside Men",2015,"KR",[],S),("Exit",2019,"KR",[],S),("Along with the Gods",2017,"KR",[]),
# Germany
("Der Untergang",2004,"DE",["Downfall","La caída","A Queda"]),("Good Bye Lenin",2003,"DE",["Good Bye, Lenin"]),
("Das Leben der Anderen",2006,"DE",["The Lives of Others","La vida de los otros","A Vida dos Outros"]),("Lola rennt",1998,"DE",["Run Lola Run","Corre, Lola, corre"]),
("Der Baader Meinhof Komplex",2008,"DE",["The Baader Meinhof Complex"]),("Fack ju Göhte",2013,"DE",["Fack ju Gohte","Suck Me Shakespeer"]),
("Keinohrhasen",2007,"DE",[]),("Kokowääh",2011,"DE",["Kokowaah"]),("Honig im Kopf",2014,"DE",[]),("Der Schuh des Manitu",2001,"DE",[]),
("Die Wolke",2006,"DE",[]),("Who Am I – Kein System ist sicher",2014,"DE",["Who Am I"],S),("Das Experiment",2001,"DE",[],S),
("Sophie Scholl – Die letzten Tage",2005,"DE",["Sophie Scholl"]),("Der Medicus",2013,"DE",["The Physician","El médico"],S),("Die Welle",2008,"DE",["The Wave","La ola","A Onda"],S),
("The Boy in the Striped Pyjamas",2008,"UK",["O Menino do Pijama Listrado","El niño con el pijama de rayas","Der Junge im gestreiften Pyjama"]),
# France
("Intouchables",2011,"FR",["The Intouchables","Amigos intocables","Intocáveis"]),("Bienvenue chez les Ch'tis",2008,"FR",["Welcome to the Sticks"]),
("Qu'est-ce qu'on a fait au Bon Dieu",2014,"FR",["Serial (Bad) Weddings"]),("La Famille Bélier",2014,"FR",["La familia Bélier"]),
("Les Choristes",2004,"FR",["The Chorus","Los chicos del coro","A Voz do Coração"]),("Le Dîner de cons",1998,"FR",["The Dinner Game"]),
("Taxi",1998,"FR",[],S),("Banlieue 13",2004,"FR",["District B13","District 13"]),("Ils",2006,"FR",["Them"],S),("Martyrs",2008,"FR",[],S),
("Haute Tension",2003,"FR",["High Tension"]),("À l'intérieur",2007,"FR",["Inside"],S),("La Rafle",2010,"FR",[]),
("Sur la piste du Marsupilami",2012,"FR",[]),("Les Visiteurs",1993,"FR",[]),("Le Prénom",2012,"FR",[]),
]
films = [{"title": f[0], "year": f[1], "country": f[2], "alts": f[3], "strict": len(f) > 4} for f in F]
os.makedirs(os.path.join(os.path.dirname(os.path.abspath(__file__)), "scan"), exist_ok=True)
json.dump(films, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "scan", "films.json"), "w"), ensure_ascii=False, indent=1)
print(len(films))
