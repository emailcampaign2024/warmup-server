import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class AccountCredentials extends Document {
  @Prop()
  fromName: string;

  @Prop({ unique: true })
  fromEmail: string;

  @Prop()
  userName: string;

  @Prop()
  appPassword: string;

  @Prop()
  smtpHost: string;

  @Prop()
  smtpPort: number;

  @Prop()
  messagePerDay: string;

  @Prop()
  minimumTimeGap: string;

  @Prop()
  imapHost: string;

  @Prop()
  imapPort: string;

  @Prop()
  tagName: string;
}

export const AccountCredentialsSchema = SchemaFactory.createForClass(AccountCredentials);
