'use strict';

require('dotenv').config()

const braintree  = require('braintree'),
      fs         = require('fs'),
      get        = require('dot-prop').get,
      moment     = require('moment'),
      FTP        = require('./lib/ftp')
      Promise    = require('bluebird');
                   require('moment-timezone');
                   

let gateway      = braintree.connect({
  environment: braintree.Environment.Sandbox,
  merchantId:  process.env.BRAINTREE_MERCHANT_ID,
  publicKey:   process.env.BRAINTREE_PUBLIC_KEY,
  privateKey:  process.env.BRAINTREE_PRIVATE_KEY
});

exports.handler = (event, context, callback) => {

  let done = (err, res) => callback(null, {
    statusCode: err ? '400' : '200',
    body: err ? JSON.stringify(err) : JSON.stringify(res),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  let beginningOfMonth = moment().startOf('month').format('MM/DD/YYYY hh:mm'),
      endOfMonth       = moment().endOf('month').format('MM/DD/YYYY hh:mm'),
      stamp            = moment().format('YYYYMM'),
      successStatuses  = ['settled'],
      failedStatuses   = ['settlement_declined', 'gateway_rejected', 'failed', 'processor_declined', 'voided'];

  let queries = [
    {
      filename: `${stamp}_SCPR-Apple-Pay_Successful.csv`,
      paymentInstrumentTypes: ['apple_pay_card'],
      statuses: successStatuses
    },
    {
      filename: `${stamp}_SCPR-Apple-Pay_Failed.csv`,
      paymentInstrumentTypes: ['apple_pay_card'],
      statuses: failedStatuses
    },
    {
      filename: `${stamp}_SCPR-Google-Pay_Successful.csv`,
      paymentInstrumentTypes: ['android_pay_card', 'google_pay_card'],
      statuses: successStatuses
    },
    {
      filename: `${stamp}_SCPR-Google-Pay_Failed.csv`,
      paymentInstrumentTypes: ['android_pay_card', 'google_pay_card'],
      statuses: failedStatuses
    }
  ].map(q => {
      return new Promise((resolve, reject) => {
        let stream = gateway.transaction.search(query => {
          query.createdAt().between(beginningOfMonth, endOfMonth);
          query.paymentInstrumentType().in(q.paymentInstrumentTypes);
          query.status().in(q.statuses);
        });
        let transactions = [];
        stream.on('data', t => transactions.push(t));
        stream.on('end', () => resolve(transactions));
        stream.on('error', err => reject(err));
      }).then(results => {
        q.results = results;
        return q;
      });
    });

  Promise.all(queries)
    .then(queries => {
      return queries.map(query => {
        query.csv = [
          // this first item is the csv header
          [
            'Date',
            'Time EST',
            'Email Address',
            'Gateway Transaction ID',
            'Payment Amount',
            'Currency Code',
            'Last Name',
            'First Name',
            'Address Line 1',
            'Address Line 2',
            'City',
            'State',
            'Zip',
            'Country',
            'Charge Card Display Number',
            'Charge Card Type',
            'Charge Card Month',
            'Charge Card Year',
            'Payment Method'
          ]
        ].concat(query.results.map(transaction => {
          let card = transaction[
            (transaction.paymentInstrumentType || '').replace(/(\_\w)/g, m => m[1].toUpperCase())
          ] || {};
          return [
            moment.tz(transaction.createdAt, 'America/Los_Angeles').format('L'),
            moment.tz(transaction.createdAt, 'America/Los_Angeles').format('HH:mm:ss'),
            get(transaction, 'customer.email'),
            transaction.id,
            transaction.amount,
            transaction.currencyIsoCode,
            get(transaction, 'customer.lastName'),
            get(transaction, 'customer.firstName'),
            get(transaction, 'billing.streetAddress'),
            get(transaction, 'billing.extendedAddress'),
            get(transaction, 'billing.locality'),
            get(transaction, 'billing.region'),
            get(transaction, 'billing.postalCode'),
            get(transaction, 'billing.countryName'),
            card.last4,
            card.cardType,
            card.expirationMonth,
            card.expirationYear,
            (transaction.paymentInstrumentType || '').replace(/_card$/, '')
          ];
        }))
        .map(line => line.join(','))
        .join('\n');
        return query;
      });
    })
    .then(queries => {
      let ftp = new FTP({
        host: process.env.EVIDENCE_FTP_HOST,
        user: process.env.EVIDENCE_FTP_USER,
        password: process.env.EVIDENCE_FTP_PASSWORD
      });
      return ftp.ready()
        .then(() => {
          return Promise.all(queries.map(query => {
            return ftp.put(
              [process.env.EVIDENCE_FTP_DIRECTORY, query.filename].filter(x => x).join('/'), query.csv
            );
          }));
        });
    })
    .then(() => {
      done(null, 'complete');
    })
    .catch(err => {
      done(err);
    });

}

