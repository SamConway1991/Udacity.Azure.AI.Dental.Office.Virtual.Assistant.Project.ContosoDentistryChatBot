// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, MessageFactory } = require('botbuilder');

const { QnAMaker } = require('botbuilder-ai');
const DentistScheduler = require('./dentistscheduler');
const IntentRecognizer = require("./intentrecognizer")

async function getAvailability() {
    let url = 'http://localhost:3000/availability';
    const response = await fetch(url);

    return response.json();
}

async function canScheduleAppointment(time) {
    let url = 'http://localhost:3000/availability';
    const response = await fetch(url);

    let data = await response.json();

    if(data.includes(time)){
        return true
    }
    return false
}



class DentaBot extends ActivityHandler {
    constructor(configuration, qnaOptions) {
        // call the parent constructor
        super();
        if (!configuration) throw new Error('[QnaMakerBot]: Missing parameter. configuration is required');

       
        // create a QnAMaker connector
        this.qnaMaker = new QnAMaker(configuration.QnAConfiguration, qnaOptions);
       
        // create a DentistScheduler connector
        this.DentistScheduler = new DentistScheduler(configuration.SchedulerConfiguration);
        // create a IntentRecognizer connector
        this.IntentRecognizer = new IntentRecognizer(configuration.LuisConfiguration)

        this.onMessage(async (context, next) => {
            // send user input to QnA Maker and collect the response in a variable
            // don't forget to use the 'await' keyword
            const qnaResults = await this.qnaMaker.getAnswers(context);
            // send user input to IntentRecognizer and collect the response in a variable
            // don't forget 'await'
            const LuisResult = await this.IntentRecognizer.executeLuisQuery(context);
            
            console.log(LuisResult.luisResult.prediction.topIntent);
            // determine which service to respond with based on the results from LUIS //
            if (LuisResult.luisResult.prediction.topIntent === 'GetAvailability' &&
                LuisResult.intents.GetAvailability.score > .7) {
                    
                   
                    let availableAppointments = await this.DentistScheduler.getAvailability();
                    // let availableAppointments = await getAvailability();

                    
                    await context.sendActivity(`Here are the available appointment times. Please specify am or pm in your response: ${availableAppointments}`);
                    await next();
                    return;
                }
            
            if (LuisResult.luisResult.prediction.topIntent === 'ScheduleAppointment' &&
                LuisResult.intents.ScheduleAppointment.score > .5) {
                    let timeAsked = LuisResult.entities.$instance.time[0].text;
                    
                    let appointmentMade = await this.DentistScheduler.scheduleAppointment(timeAsked);

                    await context.sendActivity(appointmentMade);
                    
                    await next();
                    return;
                }    
            if(qnaResults[0]){
                console.log(qnaResults[0])
                await context.sendActivity(`${qnaResults[0].answer}`);
            }
            else {
                await context.sendActivity("I'm sorry I don't understand what you're tyring to say");
                }
                
                
               
            // if(top intent is intentA and confidence greater than 50){
            //  doSomething();
            //  await context.sendActivity();
            //  await next();
            //  return;
            // }
            // else {...}
             
            await next();
    });

        this.onMembersAdded(async (context, next) => {
        const membersAdded = context.activity.membersAdded;
        //write a custom greeting
        const welcomeText = 'Hi There, I am your Denstist assistant for today! You can scedule appointments through me or I can answer any of your questions!';
        for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
            if (membersAdded[cnt].id !== context.activity.recipient.id) {
                await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
            }
        }
        // by calling next() you ensure that the next BotHandler is run.
        await next();
    });
    }
}

module.exports.DentaBot = DentaBot;
