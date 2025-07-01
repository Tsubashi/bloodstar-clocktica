This folder stores all the secrets needed to run the app. Files in this folder include:

## `db` 

A json file for connecting to the database. Contains the folowing fields:
- `host`: Hostname of the database server
- `username`: Database user
- `password`: Password for database user
- `db`: Name of the database to use

## `jwt_key.pem` and `jwt_key.pub`

The public and private key files for creating and verifying user sessions. Since we are using the RS256 algorithm, these keys can be generated as follows:

```bash
$ openssl genrsa -out jwt_key.pem 2048
$ openssl rsa -in jwt_key.pem -pubout -out jwt_key.pub 
```