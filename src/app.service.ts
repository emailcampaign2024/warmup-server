import { Injectable } from '@nestjs/common';
import * as Imap from 'imap';
import * as nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';
import { Server, UserSchema } from './user.model';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { AccountCredentials } from "./account.schema";
import { promises } from 'dns';

@Injectable()
export class AppService {
  
  private transporter;
  // private imapConfig: Imap.Config = {
  //   user: 'arundaviddev@gmail.com',
  //   password: 'srvnktnfvidfravs',
  //   host: 'imap.gmail.com',
  //   port: 993,
  //   tls: true,
  //   authTimeout: 30000,
  //   connTimeout: 30000,
  //   tlsOptions: {
  //     rejectUnauthorized: false,
  //   },
  // }
  private imapConfig: Imap.Config;

  // constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {
  //   this.fetchImapConfig();
  //   this.transporter = nodemailer.createTransport({
  //     service: 'gmail',
  //     auth: {
  //       user: 'arundaviddev@gmail.com',
  //       pass: 'srvnktnfvidfravs'
  //     },
  //     tls: {
  //       rejectUnauthorized: false,
  //     },
  //   })
  // }
  constructor(
    @InjectModel(Server.name) private readonly userModel: Model<Server>,
    @InjectModel(AccountCredentials.name) private readonly accountCredentialsModel: Model<AccountCredentials>,
  ) {
    // Fetch the IMAP configuration during service initialization
    this.fetchImapConfig().then(() => {
      // Create transporter using fetched IMAP configuration
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: this.imapConfig.user,
          pass: this.imapConfig.password
        },
        tls: {
          rejectUnauthorized: false,
        },
      });
    });
  }
  private async fetchImapConfig() {
    try {
      const users = await this.userModel.find().exec();
      if (users.length > 0) {
        // Assuming you have a single user configuration, otherwise handle accordingly
        const user = users[0];
        // Extract IMAP configuration from the user object
        this.imapConfig = {
          user: user.email, // Assuming user.email holds the IMAP user
          password: user.password, // Assuming user.imapPassword holds the IMAP password
          host: 'imap.gmail.com',
          port: 993,
          tls: true,
          authTimeout: 30000,
          connTimeout: 30000,
          tlsOptions: {
            rejectUnauthorized: false,
          },
        };
      }
    } catch (error) {
      console.error('Error fetching IMAP configuration:', error);
    }
  }


  async sendReply(to, messageId, subject) {
    const currentDate = new Date().toISOString().split('T')[0];
    // const replymessage = messageId.replace(/[<>]/g, '');
    const mailOptions = {
      from: this.imapConfig.user,
      to: to,
      subject: subject+currentDate,
      text: 'this is automated reply from company mail'+ currentDate+'....',  
      inReplyTo: messageId,
      references: [messageId], 
    }

      // // Set the `inReplyTo` and `references` headers to maintain the same thread
      // mailOptions.inReplyTo = messageId;
      // mailOptions.references = [messageId];
    

    try {
      console.log('messagedetails',mailOptions);
      const reply = await this.transporter.sendMail(mailOptions);
      console.log('reply sent successfully',reply);
      return {
        success: true,
        message: 'reply sent successfully',
        // reply,
      }
    } catch (error) {
      console.log('Error sending reply:', error);
      return {
        success: false,
        message: `Failed to send reply. Error: ${error.message}`,
      };
    }
  }


  async getEmail(): Promise<any> {
    return new Promise(async (resolve, reject) => {
      try {
        while (true) {
          const imap = new Imap(this.imapConfig);
          let count = 0;
          const parsingPromises = [];
          const emailDetails = [];
          const accountdata = await this.getAccountData();

          imap.once('ready', () => {  
            imap.openBox('INBOX', false, () => {
              imap.search(['UNSEEN', ['FROM', accountdata.fromEmail]], (err, results) => {
                if (err) {
                  console.log('Error searching for unseen emails:', err);
                  imap.end();
                  reject(err);
                  return;
                }

                const latest = results.slice(-1);

                if (latest.length === 0) {
                  console.log('No unseen emails found.');
                  imap.end();
                  resolve({ message: 'No unseen emails found.' });
                  return;
                }

                const f = imap.fetch(latest, { bodies: '' });

                f.on('message', (msg) => {
                  msg.on('body', (stream) => {
                    const parsingPromise = new Promise((resolve) => {
                      simpleParser(stream, async (parseErr, parsed) => {
                        if (parseErr) {
                          console.error('Error parsing email:', parseErr);
                          reject(parseErr);
                          return;
                        }
                        console.log('Received Email:', parsed);
                        const isInInbox = results.includes(parsed.messageId);
                        emailDetails.push({ parsed });
                        
                        setTimeout(async () => {
                          const { parsed } = emailDetails[0];
                          this.sendReply(emailDetails[0].parsed.from.value[0].address, emailDetails[0].parsed.messageId, emailDetails[0].parsed.subject )
                        }, 120000); 
                        count++;

                        if (count >= latest.length) {
                          resolve(null);
                        }
                      });
                    });

                    parsingPromises.push(parsingPromise);
                  });

                  msg.once('attributes', (attrs) => {
                    const { uid } = attrs;
                    imap.addFlags(uid, ['\\Seen'], () => {
                      console.log('Marked as read!');
                    });
                  });
                });

                f.once('error', (ex) => {
                  console.error('Error fetching messages:', ex);
                  imap.end();
                  reject(ex);
                });

                f.once('end', async () => {
                  await Promise.all(parsingPromises);
                  console.log('Done fetching latest 10 messages!');
                  imap.end();
                  resolve({ message: 'Streaming successful!', emailDetails: emailDetails });
                });
              });
            });
          });

          imap.once('error', (err) => {
            console.error(err);
            reject(err);
          });

          imap.once('end', () => {
            console.log('Connection ended');
          });

          imap.connect();

          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (ex) {
        console.error('An error occurred:', ex);
        reject(ex);
      }
    });
  }

  async createUser(email: string, password: string): Promise<Server> {
    const createdUser = new this.userModel({ email, password });
    return createdUser.save();
  }

  async getUsers(): Promise<Server[]> {
    const users = await this.userModel.find().exec();
    console.log('Retrieved users:', users);
    return users;
  }

  // async getaccountdata():  Promise<AccountCredentials| null> {
  //   const accountCredentialsData = await this.accountCredentialsModel.find().exec();
  //   console.log(accountCredentialsData,"accountCredentialsData");
  //   return accountCredentialsData;
  // }

  async getAccountData(): Promise<AccountCredentials | null> {
    try {
      const accountCredentialsData = await this.accountCredentialsModel.findOne().exec();
      console.log(accountCredentialsData, "accountCredentialsData");
      return accountCredentialsData;
    } catch (error) {
      console.error('Error retrieving account data:', error);
      throw error;
    }
  }
  

}



// import { Injectable } from '@nestjs/common';
// import * as Imap from 'imap';
// import * as nodemailer from 'nodemailer';
// import { simpleParser } from 'mailparser';

// @Injectable()
// export class AppService {
//   private transporter;
//   private imapConfig: Imap.Config = {
//     user: 'gokulsidharth02@gmail.com',
//     password: 'wypqevvlfqdcwcqb',
//     host: 'imap.gmail.com',
//     port: 993,
//     tls: true,
//     authTimeout: 30000,
//     connTimeout: 30000,
//     tlsOptions: {
//       rejectUnauthorized: false,
//     },
//   }

//   constructor() {
//     this.transporter = nodemailer.createTransport({
//       service: 'gmail',
//       auth: {
//         user: 'gokulsidharth02@gmail.com',
//         pass: 'wypqevvlfqdcwcqb'
//       },
//       tls: {
//         rejectUnauthorized: false,
//       },
//     })
//   }

//   async sendReply(to) {
//     const mailOptions = {
//       from: this.imapConfig.user,
//       to: to,
//       subject: 'reply from company mail',
//       text: 'this is automated reply from company mail'
//     }

//     try {
//       const reply = await this.transporter.sendMail(mailOptions);
//       console.log('reply sent successfully');
//       return {
//         success: true,
//         message: 'reply sent successfully',
//         reply,
//       }
//     } catch (error) {
//       console.log('Error sending reply:', error);
//       return {
//         success: false,
//         message: `Failed to send reply. Error: ${error.message}`,
//       };
//     }
//   }

//   async getEmail(): Promise<any> {
//     return new Promise(async (resolve, reject) => {
//       let emailDetails = []; 
//       try {
//         const imap = new Imap(this.imapConfig);
//         imap.once('ready', () => {
//           imap.openBox('INBOX', false, () => {
//             imap.search(['UNSEEN', ['FROM', 'rajakumarandevloper@gmail.com']], (err, results) => {
//               if (err) {
//                 console.log('Error searching for unseen emails:', err);
//                 imap.end();
//                 reject(err);
//                 return;
//               }

//               const latest = results.slice(-1);

//               if (latest.length === 0) {
//                 console.log('No unseen emails found.');
//                 imap.end();
//                 resolve({ message: 'No unseen emails found.' });
//                 return;
//               }

//               const f = imap.fetch(latest, { bodies: '' });

//               f.on('message', (msg) => {
//                 let emailDetails = [];
//                 let count = 0;
//                 msg.on('body', (stream) => {
//                   const parsingPromise = new Promise((resolve) => {
//                     simpleParser(stream, async (parseErr, parsed) => {
//                       if (parseErr) {
//                         console.error('Error parsing email:', parseErr);
//                         reject(parseErr);
//                         return;
//                       }
//                       console.log('Received Email:', parsed);
//                       emailDetails.push({ parsed });
//                       count++;

//                       if (count >= latest.length) {
//                         resolve(null);
//                       }
//                     });
//                   });
//                 });

//                 msg.once('attributes', (attrs) => {
//                   const { uid } = attrs;
//                   imap.addFlags(uid, ['\\Seen'], () => {
//                     console.log('Marked as read!');
//                   });

//                   // Sending reply after two minutes
//                   setTimeout(async () => {
//                     const { parsed } = emailDetails[0]; // Assuming you want to reply to the first email
//                     await this.sendReply(parsed.from.value[0].address);
//                   }, 120000); // 2 minutes in milliseconds
//                 });
//               });

//               f.once('error', (ex) => {
//                 console.error('Error fetching messages:', ex);
//                 imap.end();
//                 reject(ex);
//               });

//               f.once('end', async () => {
//                 console.log('Done fetching latest messages!');
//                 imap.end();
//                 resolve({ message: 'Streaming successful!', emailDetails: emailDetails });
//               });
//             });
//           });
//         });

//         imap.once('error', (err) => {
//           console.error(err);
//           reject(err);
//         });

//         imap.once('end', () => {
//           console.log('Connection ended');
//         });

//         imap.connect();
//       } catch (ex) {
//         console.error('An error occurred:', ex);
//         reject(ex);
//       }
//     });
//   }
// }
