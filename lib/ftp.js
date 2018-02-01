'use strict';

const ftp          = require('ftp');
const EventEmitter = require('events');

class FTP extends EventEmitter {
  constructor(options){
    super();
    this.ftp = new ftp();
    this.ftp.connect(options);
    this.ftp.on('ready', e => this.emit('ready', e));
    this.ftp.on('error', e => this.emit('error', e));
  }
  list(dir) {
    return new Promise((resolve, reject) => {
      this.ftp.list('/audio/newscast', (err, list) => {
        if (err) return reject(err);
        resolve(list);
      });
    });
  }
  get(path) {
    return new Promise((resolve, reject) => {
      this.ftp.get(path, (err, stream) => {
        if (err) return reject(err);
        resolve(stream);
      });
    });
  }
  put(path, data){
    return new Promise((resolve, reject) => {
      this.ftp.put(data, path, (err, stream) => {
        if (err) return reject(err);
        resolve(stream);
      });
    })
  }
  end(){
    this.ftp.end();
  }
  ready(){
    return new Promise((resolve, reject) => {
      this.on('ready', resolve);
      this.on('error', reject);
    });
  }
}

module.exports = FTP;

