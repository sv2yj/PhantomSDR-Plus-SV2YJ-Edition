# How to update markers.json

- Unzip the file "frequencylist.zip" into the folder cd $HOME/PhantomSDR-Plus/frequencylist/.
- Modify the file "mymarkers.json" with your own markers.
- download from https://new.hfcc.org/data/ the newest list, at the buttom of page, current: **a26allx2.zip** - a26 Operational Schedule - **Last updated on 09-jul-2026** 
- unzip the downloaded file from the database into the folder frequencylist.
- ensure that "A26all00.TXT" and "broadcas.txt" are located in the "frequencylist" folder
- modify "update-markers.sh" line 5 to your personal full path -->  "cd $HOME/PhantomSDR-Plus/frequencylist/". Make this file executable.
- **NB** don't use '~ ' if you use the cron service e.g. use cd home/user/PhantomSDR-Plus/frequencylist/
- run update script with "update-markers.sh" manually or let it run automaticly by a cron job (for example update every 15 minutes a hour 'crontab -e' and enter: */15 * * * * /usr/bin/bash /home/$USER/PhantomSDR-Plus/frequencylist/update-markers.sh >> /home/$USER/frequencylist.log 2>&1') where $USER is the user linux account.
- The script will generate the "shortwavestations.json" based on the data given from the database and finaly will merge it with "mymarkers.json", so to create the final "markers.json" in the root PhantomSDR-Plus folder).
- **NB** Your markers in mymarkers.json will overwrite and replace the duplicate markers from shortwavestations.json in the final markers.json file which will be generated. The given mymarkers.json contains some demo markers, you can replace them with your own!

---

# Deutsch — markers.json aktualisieren

- Entpacken Sie die Datei "frequencylist.zip" in den Ordner $HOME/PhantomSDR-Plus/frequencylist/.
- Tragen Sie Ihre eigenen Marker in die Datei "mymarkers.json" ein.
- Laden Sie von https://new.hfcc.org/data/ die neueste Liste herunter — am Ende der Seite, derzeit: **a26allx2.zip** - a26 Operational Schedule - **zuletzt aktualisiert am 09.07.2026**
- Entpacken Sie die heruntergeladene Datenbankdatei in den Ordner frequencylist.
- Stellen Sie sicher, dass "A26all00.TXT" und "broadcas.txt" im Ordner "frequencylist" liegen.
- Ändern Sie in "update-markers.sh" die Zeile 5 auf Ihren vollständigen Pfad --> "cd $HOME/PhantomSDR-Plus/frequencylist/" und machen Sie die Datei ausführbar.
- **Achtung:** Verwenden Sie kein '~', wenn Sie den cron-Dienst nutzen, sondern z. B. cd /home/user/PhantomSDR-Plus/frequencylist/
- Führen Sie "update-markers.sh" von Hand aus oder lassen Sie es per cron-Job automatisch laufen (zum Beispiel alle 15 Minuten: 'crontab -e' und dort */15 * * * * /usr/bin/bash /home/$USER/PhantomSDR-Plus/frequencylist/update-markers.sh >> /home/$USER/frequencylist.log 2>&1 eintragen), wobei $USER Ihr Linux-Benutzerkonto ist.
- Das Skript erzeugt aus den Daten der Datenbank die Datei "shortwavestations.json" und führt sie anschließend mit "mymarkers.json" zusammen, um im Stammverzeichnis von PhantomSDR-Plus die endgültige "markers.json" zu erstellen.
- **Achtung:** Ihre Marker aus mymarkers.json überschreiben in der erzeugten markers.json die doppelten Marker aus shortwavestations.json. Die mitgelieferte mymarkers.json enthält einige Beispielmarker, die Sie durch Ihre eigenen ersetzen können!

---

# Ελληνικά — Πώς να ενημερώσετε το markers.json

- Αποσυμπιέστε το αρχείο "frequencylist.zip" στον φάκελο $HOME/PhantomSDR-Plus/frequencylist/.
- Τροποποιήστε το αρχείο "mymarkers.json" με τους δικούς σας δείκτες.
- Κατεβάστε από το https://new.hfcc.org/data/ την πιο πρόσφατη λίστα, στο κάτω μέρος της σελίδας, τρέχουσα: **a26allx2.zip** - a26 Operational Schedule - **τελευταία ενημέρωση 09-Ιουλ-2026**
- Αποσυμπιέστε το αρχείο που κατεβάσατε από τη βάση δεδομένων στον φάκελο frequencylist.
- Βεβαιωθείτε ότι τα "A26all00.TXT" και "broadcas.txt" βρίσκονται στον φάκελο "frequencylist".
- Τροποποιήστε τη γραμμή 5 του "update-markers.sh" με τη δική σας πλήρη διαδρομή --> "cd $HOME/PhantomSDR-Plus/frequencylist/" και κάντε το αρχείο εκτελέσιμο.
- **ΠΡΟΣΟΧΗ:** μη χρησιμοποιείτε '~' αν χρησιμοποιείτε την υπηρεσία cron· γράψτε π.χ. cd /home/user/PhantomSDR-Plus/frequencylist/
- Εκτελέστε το "update-markers.sh" χειροκίνητα ή αφήστε το να τρέχει αυτόματα με cron (για παράδειγμα κάθε 15 λεπτά: 'crontab -e' και εισαγωγή */15 * * * * /usr/bin/bash /home/$USER/PhantomSDR-Plus/frequencylist/update-markers.sh >> /home/$USER/frequencylist.log 2>&1), όπου $USER είναι ο λογαριασμός χρήστη Linux.
- Το script δημιουργεί το "shortwavestations.json" από τα δεδομένα της βάσης και τελικά το συγχωνεύει με το "mymarkers.json", ώστε να παραχθεί το τελικό "markers.json" στον ριζικό φάκελο του PhantomSDR-Plus.
- **ΠΡΟΣΟΧΗ:** Οι δικοί σας δείκτες στο mymarkers.json αντικαθιστούν τους διπλότυπους δείκτες από το shortwavestations.json στο τελικό markers.json που θα δημιουργηθεί. Το mymarkers.json που δίνεται περιέχει μερικούς δείκτες επίδειξης — μπορείτε να τους αντικαταστήσετε με δικούς σας!

---

# Español — Cómo actualizar markers.json

- Descomprima el archivo "frequencylist.zip" en la carpeta $HOME/PhantomSDR-Plus/frequencylist/.
- Modifique el archivo "mymarkers.json" con sus propios marcadores.
- Descargue de https://new.hfcc.org/data/ la lista más reciente, al final de la página, actualmente: **a26allx2.zip** - a26 Operational Schedule - **última actualización 09-jul-2026**
- Descomprima en la carpeta frequencylist el archivo descargado de la base de datos.
- Asegúrese de que "A26all00.TXT" y "broadcas.txt" estén en la carpeta "frequencylist".
- Modifique la línea 5 de "update-markers.sh" con su ruta completa --> "cd $HOME/PhantomSDR-Plus/frequencylist/" y dé permisos de ejecución al archivo.
- **NOTA:** no use '~' si emplea el servicio cron; escriba por ejemplo cd /home/user/PhantomSDR-Plus/frequencylist/
- Ejecute "update-markers.sh" a mano o deje que se ejecute automáticamente mediante una tarea cron (por ejemplo cada 15 minutos: 'crontab -e' e introduzca */15 * * * * /usr/bin/bash /home/$USER/PhantomSDR-Plus/frequencylist/update-markers.sh >> /home/$USER/frequencylist.log 2>&1), donde $USER es su cuenta de usuario de Linux.
- El script genera "shortwavestations.json" a partir de los datos de la base de datos y finalmente lo combina con "mymarkers.json" para crear el "markers.json" definitivo en la carpeta raíz de PhantomSDR-Plus.
- **NOTA:** Sus marcadores de mymarkers.json sobrescriben y reemplazan los marcadores duplicados de shortwavestations.json en el markers.json final que se genera. El mymarkers.json incluido contiene algunos marcadores de ejemplo, ¡puede sustituirlos por los suyos!

---

# Français — Comment mettre à jour markers.json

- Décompressez le fichier "frequencylist.zip" dans le dossier $HOME/PhantomSDR-Plus/frequencylist/.
- Modifiez le fichier "mymarkers.json" avec vos propres repères.
- Téléchargez sur https://new.hfcc.org/data/ la liste la plus récente, en bas de la page, actuellement : **a26allx2.zip** - a26 Operational Schedule - **dernière mise à jour le 09/07/2026**
- Décompressez dans le dossier frequencylist le fichier téléchargé depuis la base de données.
- Vérifiez que "A26all00.TXT" et "broadcas.txt" se trouvent bien dans le dossier "frequencylist".
- Modifiez la ligne 5 de "update-markers.sh" avec votre chemin complet --> "cd $HOME/PhantomSDR-Plus/frequencylist/" et rendez le fichier exécutable.
- **NB :** n'utilisez pas '~' si vous passez par le service cron ; écrivez par exemple cd /home/user/PhantomSDR-Plus/frequencylist/
- Lancez "update-markers.sh" à la main ou laissez-le tourner automatiquement via une tâche cron (par exemple toutes les 15 minutes : 'crontab -e' puis */15 * * * * /usr/bin/bash /home/$USER/PhantomSDR-Plus/frequencylist/update-markers.sh >> /home/$USER/frequencylist.log 2>&1), où $USER est votre compte utilisateur Linux.
- Le script génère "shortwavestations.json" à partir des données de la base, puis le fusionne avec "mymarkers.json" afin de créer le "markers.json" final à la racine du dossier PhantomSDR-Plus.
- **NB :** vos repères de mymarkers.json écrasent et remplacent les repères en double venant de shortwavestations.json dans le markers.json final qui sera généré. Le mymarkers.json fourni contient quelques repères de démonstration, que vous pouvez remplacer par les vôtres !

---

# Hrvatski — Kako ažurirati markers.json

- Raspakirajte datoteku "frequencylist.zip" u mapu $HOME/PhantomSDR-Plus/frequencylist/.
- U datoteci "mymarkers.json" upišite vlastite oznake.
- S adrese https://new.hfcc.org/data/ preuzmite najnoviji popis, na dnu stranice, trenutno: **a26allx2.zip** - a26 Operational Schedule - **posljednje ažuriranje 09.07.2026.**
- Preuzetu datoteku iz baze raspakirajte u mapu frequencylist.
- Provjerite nalaze li se "A26all00.TXT" i "broadcas.txt" u mapi "frequencylist".
- U datoteci "update-markers.sh" izmijenite 5. redak na svoju punu putanju --> "cd $HOME/PhantomSDR-Plus/frequencylist/" i učinite datoteku izvršnom.
- **NAPOMENA:** ne koristite '~' ako se služite cron uslugom; upišite npr. cd /home/user/PhantomSDR-Plus/frequencylist/
- Pokrenite "update-markers.sh" ručno ili ga pustite da se izvodi automatski cron poslom (na primjer svakih 15 minuta: 'crontab -e' pa unesite */15 * * * * /usr/bin/bash /home/$USER/PhantomSDR-Plus/frequencylist/update-markers.sh >> /home/$USER/frequencylist.log 2>&1), pri čemu je $USER vaš Linux korisnički račun.
- Skripta iz podataka baze stvara "shortwavestations.json" i naposljetku ga spaja s "mymarkers.json" kako bi u korijenskoj mapi PhantomSDR-Plusa nastao konačni "markers.json".
- **NAPOMENA:** Vaše oznake iz mymarkers.json u konačnom markers.json prepisuju i zamjenjuju dvostruke oznake iz shortwavestations.json. Priloženi mymarkers.json sadrži nekoliko oglednih oznaka koje možete zamijeniti vlastitima!

---

# Русский — Как обновить markers.json

- Распакуйте файл "frequencylist.zip" в папку $HOME/PhantomSDR-Plus/frequencylist/.
- Впишите свои метки в файл "mymarkers.json".
- Скачайте с https://new.hfcc.org/data/ самый свежий список, внизу страницы, сейчас это: **a26allx2.zip** - a26 Operational Schedule - **последнее обновление 09.07.2026**
- Распакуйте скачанный файл базы в папку frequencylist.
- Убедитесь, что "A26all00.TXT" и "broadcas.txt" находятся в папке "frequencylist".
- В файле "update-markers.sh" измените строку 5 на свой полный путь --> "cd $HOME/PhantomSDR-Plus/frequencylist/" и сделайте файл исполняемым.
- **ВНИМАНИЕ:** не используйте '~', если работаете через службу cron; пишите, например, cd /home/user/PhantomSDR-Plus/frequencylist/
- Запускайте "update-markers.sh" вручную либо оставьте его выполняться автоматически заданием cron (например, каждые 15 минут: 'crontab -e' и строка */15 * * * * /usr/bin/bash /home/$USER/PhantomSDR-Plus/frequencylist/update-markers.sh >> /home/$USER/frequencylist.log 2>&1), где $USER — ваша учётная запись Linux.
- Скрипт создаёт "shortwavestations.json" по данным из базы и затем объединяет его с "mymarkers.json", чтобы в корневой папке PhantomSDR-Plus получился итоговый "markers.json".
- **ВНИМАНИЕ:** Ваши метки из mymarkers.json перезаписывают и заменяют дублирующиеся метки из shortwavestations.json в итоговом markers.json. В поставляемом mymarkers.json есть несколько демонстрационных меток — замените их своими!
