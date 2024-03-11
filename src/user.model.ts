// user.model.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Server extends Document {

  @Prop({ unique: true })
  email: string;

  @Prop()
  password: string; 
}

export const UserSchema = SchemaFactory.createForClass(Server);
