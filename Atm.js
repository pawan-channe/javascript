
const module$ = require('readline-sync');

const input = module$.questionInt('\nPress 1 to Start:');
if (input==1) {
    var inputInt = module$.questionInt('Enter Your Card Number:');
    var inputStr = inputInt.toString();
    if (inputStr.length == 16) {
        const Lang = module$.questionInt('\nPress 1 for English\nPress 2 for Hindi\n');
        if (Lang == 1) {
            const Guess = module$.questionInt('Enter Any Number Between 9 and 99\nfor eg."25"\n');
            if (Guess >9 && Guess<99) {
                const pinInt = module$.questionInt('Please Enter Your Pin:');
                const pinStr = pinInt.toString();
                if (pinStr.length == 4) {
                    const AccType = module$.questionInt('\nPlease Select Account Type\nPress 1 for Current\nPress 2 for Saving\n');
                    if (AccType == 1 || AccType == 2) {
                        const Option = module$.questionInt('Press 1 for WITHDRAWAL\nPress 2 for DEPOSIT\nPress 3 for PIN CHANGE\nPress 4 for BALANCE INQUIRY\n');
                        var allAmount = 17000;
                        if (Option == 1) {
                            const Amount = module$.questionInt('Please Enter Amount:');
                            console.log('Transaction Completed Successfully\nPlease Collect Your Cash\nYour Account Balance:',allAmount-Amount);
                        }
                        else if (Option == 2) {
                            const Deposit = module$.questionInt('Please Enter Amount to Deposit:');
                            console.log('Cash Deposited Successfully\nYour Total Account Balance is:',allAmount+Deposit);
                        }
                        else if (Option == 3) {
                            const OldPin = module$.questionInt('Enter Old Pin:')
                            if (OldPin == pinInt) {
                                const NewPin = module$.questionInt('Enter New Pin:')
                                console.log('Your Pin Changed Successfully');
                            }
                            else if (OldPin != pinInt) {
                                console.log("Old Pin Doesn't Match to Previous\nPlease Try Again..!");
                            }
                        }
                        else if (Option == 4) {
                            console.log('Your Card Number is:',inputInt);
                            console.log('Your ATM Pin is:',pinInt);
                            console.log('Your Total Account Balance is:',allAmount);
                        }
                        else {
                            console.log('Oops you entered something wrong---');
                        }
                    }
                    else {
                        console.log("Option doesn't exist");
                    }
                }

                else if (pinStr.length<4 || pinStr.length>4) {
                    console.log('length must be 4 characters');
                }
            }

            else {
                console.log('You guess wrong number');
            }
        }
        
        else if (Lang == 2) {
            console.log('Currently Hindi Not Available');}
        else {
            console.log('Please Select a Valid Option');
        }
    }

    else if (inputStr.length<16 || inputStr.length>16) {
        console.log('length must be 16 characters');
    }
}

else {
    console.log('You entered wrong number,\nplease try again..!');
}

