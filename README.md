Evidence (Braintree DevOps Reporting)
=====================================

Generate CSV reports of transactions for the current month and upload them to an FTP server.

Designed as an AWS Lambda function.

## Installation

`npm install`

The required environment variables are listed in `.env.template`.

## Development

The function can be run locally using `node runner.js`.

A docker-compose file has been provided for setting up a development FTP server.

Assuming that you have docker-compose installed, start the container by running:

```sh
docker-compose up -d
```

You will then have to set up a new user.  Let's say you create a user named "bob".  Create a shell for the container:

```sh
docker-compose exec evidence-ftp /bin/bash
```

And then run this line:

```sh
pure-pw useradd bob -f /etc/pure-ftpd/passwd/pureftpd.passwd -m -u ftpuser -d /home/ftpusers/bob
```

It will then ask you to type in a password.  Afterwords, you can exit the shell.

You FTP server is now running and ready to be used.  Make sure you set up these environment variables before testing:

- **EVIDENCE_FTP_HOST** (probably localhost for development)
- **EVIDENCE_FTP_USER**
- **EVIDENCE_FTP_PASSWORD**

You can also use a .env file out of the box.  Just use `.env.template` as a reference.

