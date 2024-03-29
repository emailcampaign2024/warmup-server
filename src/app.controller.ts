import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('company')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('get-emails')
  async getEmails(){
    try{
      const emails = await this.appService.getEmail();
      return {
        success :true,
        emails
      };
    } catch ( error ) {
      return {
        success : false ,
        message : `Failed to retrieve emails , Error : ${error.message}`
      }
    }
  }

  @Post('create')
  async createUser(@Body('email') email: string, @Body('password') password: string) {
    return this.appService.createUser(email, password);
  }
}
