Tous les tests doivent être fait avec l'API TacticalIO.
Tout test fait avec un autre fichier que ceux que j'ai fournis doit être mentionné et le fichier de test disponible dans l'exacte version qui a été utilisée.
Pour chaque vérification ci-dessous, rajouter le nom du ou des fichiers de test qui ont été utilisés.
Les tests doivent être faits avec toutes les cartes sur la stack (voir fichier de conf avec DUMMY pour avoir les mêmes nom d'E/S).

###A. FSKCOM###

1. RS485
	a- pourquoi à 9600 ça passait sur le RX au lieu de TX ?
	b- observer les trames (messages): il faut que chaque trame corresponde au nombre de chars envoyés (voir d)
	c- vérifier l'envoi décalé dans le temps
	d- compter les messages côté extérieur (réception) et comparer à ce qui aurait dû être envoyé. Vérifier que pas de message perdu. Vérifier que chaque trame à le bon nombre de caractère. Comparer les trames attendues avec celles envoyées. Timestamper les messages en réception de manière à observer la périodicité en réception. 

2. RS232:
	faire les points b, c, d du RS 485

3. FSK
Tous les tests ci-dessous sont à faire sur les deux ports.
	a- Vérifier les envois. En situation aussi proche que possible du réel, càd:
		- Nombre d'envois >= 1000
		- période 10ms
		- trame de 128 octets
	b- vérifier la même chose avec une trame de 107 octets
	c- trouver un moyen de vérifier que le contenu du message FSK correspond bien à la trame (autrement dit, vérifier que le nombre de bits et bon et que les bits sont biens ceux envoyés et il n'y a pas d'erreur). Essayer de trouver un moyen automatisé pour cela (utiliser le comparateur de la carte FSK ?...)
	d- vérifier que l'amplitude se modifie bien au prorata. Tester 4 points de test (par exemple, 1V, 3V, 5v et max).

###B. GPIO32###

1. Vérifier toutes les E/S (ceci permet de m'assurer par rapport aux échanges SPI/FPGA, ce qui laisse comme pb possible uniquement un pb électrique, sachant que les cartes ne sont pas les mêmes). Ce test doit se faire e amnière à s'assurer que chaque E/S est adressée individuellement correctement. Par exemple, juste positionner toutes les S à 1 en même temps, n'est pas significatif.
2. Vérifier en situation réelle la génération de pattern, càd en variant la fréquence toutes les 10ms. Ceci est un test dynamique, donc, si possible, vérifier ponctuellement que la fréquence correspond à la consigne. Le test doit permettre de connaître la consigne en fonction du temps. On évite les traces côté code pour ne pas biaiser les tests.
3. Vérifier statiquement sur 10 points de fréquence que les deux générateur suivent exactement la consigne. Par exemple: 3Hz, 43Hz, 371Hz, 913Hz, 4917Hz, 9Khz, 12kHz, 14kHz, 18kHz, 22.5kHz

###C. AIO12###

1. Vérifier toutes les E/S (voir B.1)
2. Vérifier une sortie en conditions réelles (interval 10ms, variation type sin par exemple)

###D. CPU###

1. Vérifier toutes les E/S (voir B.1)
2. Vérifier que la RTC fonctionne

###E. Situation réelle###

1. Analyser le résultat du test complet simulant une situation réelle.
2. Analyser en particulier les performances

Pour E. un fichier: ./test.js

État 20141212 22:00:
A.1.a. Inconnu
A.1.b. Partiellement bon
A.1.c. KO
A.1.d. Inconnu (pour cause de trames collées, mains ne peut être déclaré KO)
A.2.b. Partiellement bon
A.2.c. KO
A.2.d. Bon à 100ms, ne peut être déclaré OK
===> A.3. avant modification en cours
A.3.a. Partiel
A.3.b. Non effectué
A.3.c. Non effectué
A.3.d. KO
B.1. OK
B.2. Non effectué
B.3. OK (l'erreur de précision n'est présente qu'en basse fréquence, donc c'est bon)
C.1. Partiellement bon, mais problème de chute de tension qui peut se relever bloquant
C.2. Attente du règlement de C.1.
D.1. Non effectué
D.2. Non effectué
E. Non effectué, attente de règlement des points bloquants et du codage en cours