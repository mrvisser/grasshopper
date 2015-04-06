Data import from the Django Timetables application
==================================================

The scripts in this folder allow you to generate the necessary data files to import data from the
Django application.


## 1. Generate a CSV file that contains all the data in the Django database.

Follow the instructions in the `django-export-csv-command.py` file


## 2. Generate a JSON tree of the CSV data

This can be done by executing:
```
node etc/scripts/data/old-stack-import/generate-tree --input path/to/csv --output tree.json
```
This script will also take care of date rollovers. Events that take place on Tuesday in week 3 of Lent
should take place on Tuesday in week 3 of Lent in the next academical year.

If you don't want certain modules, parts or subjects, you can easily remove them from the tree


## 3. Augment the events with the Shibboleth identifiers of the organisers

If you've already imported a set of users into your system, you can link the imported events to
these users.

This can be done by executing
```
node etc/scripts/data/old-stack-import/augment-tree-with-user-shibboleth-ids.js --tree tree.json --output tree-with-shib-ids.json --users users.csv
```


## 4. Import

This can be done by executing:
```
node etc/scripts/data/oneoff-import.js --file tree.json --app 1
```

Depending on the data set and the server setup, this can easily take 30 minutes, so be patient.
