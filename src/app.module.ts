import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { UserSchema, Server} from './user.model';
import { AccountCredentials,AccountCredentialsSchema } from './account.schema';

@Module({
  imports: [ ConfigModule.forRoot({
    envFilePath: '.env',
    isGlobal: true,
  }),
  MongooseModule.forRoot(process.env.DB_URI),
  MongooseModule.forFeature([{ name: AccountCredentials.name, schema: AccountCredentialsSchema }]),
  MongooseModule.forFeature([{ name: Server.name, schema: UserSchema }]),],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}


