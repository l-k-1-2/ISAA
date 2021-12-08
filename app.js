const {
    MongoClient
} = require("mongodb");
const express = require("express");
const bodyParser = require('body-parser');
const CryptoJS = require('crypto-js');
const {
    enc
} = require("crypto-js");

const {
    json
} = require("body-parser");
const {
    response
} = require("express");
var app = express();

app.use('/', express.static(__dirname + "/public"));
app.use(
    express.urlencoded({
        extended: true
    })
)

app.use(bodyParser.urlencoded({
    extended: true
}));

app.set('view engine', 'ejs');

var uri = "mongodb+srv://mydatabase:mydatabase@cluster0.ozajz.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";
var DataBase = "ISAABank";

var commonKey="jewhbvewruyrg347r3vbrgbtr6trgreou43y7r34f+516512";
commonKey = CryptoJS.SHA256(commonKey).toString();
console.log(commonKey);


// Mongo Functions
async function createListing(newListing, collection) {
    var client = new MongoClient(uri);
    try {
        await client.connect();
        var result = await client.db(DataBase).collection(collection).insertOne(newListing);
        client.close();
        console.log("Created Succesfully");
    } catch (error) {
        console.log(error);
    }
}

async function find(parameter, collection) {
    var client = new MongoClient(uri);
    await client.connect();
    var res = await client.db(DataBase).collection(collection).findOne(parameter);
    await client.close();
    return res;
}

async function update(sender, RecObj, amount) {
    var collection = "UserDB"
    var client = new MongoClient(uri);

    try {
        await client.connect();

        RecAcc = CryptoJS.AES.encrypt(RecObj._id.toString(), commonKey).toString();
        amt = CryptoJS.AES.encrypt(amount.toString(), commonKey).toString();
        SendAcc=CryptoJS.AES.encrypt(sender.toString(), commonKey).toString();

        var tranObj = {
            "sender": SendAcc,
            "reciever": RecAcc,
            "amount": amt
        }
        console.log(sender);
        console.log(typeof(sender));
        var senderObj = await find({ "_id": sender},collection);
        var SenderQuery = {"_id": sender}
        var newbal = parseInt(senderObj.balance) - amount;

        var transAttr = senderObj.transactions;
        var l = Object.keys(transAttr).length;
        transAttr[l] = tranObj;

        var update = {
            "$set": {
                balance: newbal,
                transactions: transAttr
            }
        }

        client.db(DataBase).collection(collection).updateOne(SenderQuery, update, (err) => {
            if (err)
                throw err;
            else {
                console.log("Subtracted succesfully");
            }
        });

        var RecQuery = {"_id": RecObj._id}
        var newbal = parseInt(RecObj.balance) + amount;
        console.log(newbal);

        var update = {
            "$set": {
                balance: newbal,
                transactions: transAttr
            }
        }

        client.db(DataBase).collection("UserDB").updateOne(RecQuery, update,async (err) => {
            if (err)
                throw err;
            else {
                console.log("Added succesfully");
                await client.close();
            }
        });


    } catch (error) {
        console.log(error);
    }
}

// Login screen and homepage
app.get('/', (req, res) => {

    res.render(__dirname + '/Views/homepage.ejs', {
        status: ""
    })

});

var info, obj;

app.post('/', async (req, res) => {

    var key = CryptoJS.SHA256(req.body.pass).toString();
    var acc = req.body.acc;
    acc = parseInt(acc);
    obj = await find({
        _id: acc
    }, "UserDB");

    if (obj == null) {
        console.log("Null");
        res.render(__dirname + '/Views/homepage.ejs', {
            status: "Invalid credentials"
        })
    } else {

        obj.password = CryptoJS.AES.decrypt(obj.password, key).toString(enc.Utf8);

        if (obj.password != key) {
            console.log("Invalid password");
            res.render(__dirname + '/Views/homepage.ejs', {
                status: "Invalid credentials"
            })
        } else {
            try {

                obj.accountDetails.name = CryptoJS.AES.decrypt(obj.accountDetails.name, key).toString(enc.Utf8);
                obj.accountDetails.email = CryptoJS.AES.decrypt(obj.accountDetails.email, key).toString(enc.Utf8);
                obj.accountDetails.phone = CryptoJS.AES.decrypt(obj.accountDetails.phone, key).toString(enc.Utf8);
                obj.accountDetails.address = CryptoJS.AES.decrypt(obj.accountDetails.address, key).toString(enc.Utf8);

                console.log("Result found");
                res.redirect("/UserAccount/" + obj._id);
            } catch (error) {
                console.log(error);
            }
        }
    }
});

// User info page
app.get("/UserAccount/:a",async (req, res) => {
    res.render(__dirname + '/Views/userAccount.ejs', {
        info: obj,
        status:"",
        classVal:"none"
    })
})

// Create Account
app.get('/CreateAccount', (req, res) => {
    res.sendFile(__dirname + '/Views/CreateAccount.html');
})

app.post('/CreateAccount', async (req, res) => {

    var listing = {
        "_id": Math.floor(Math.random() * (9999999999 - 1000000000)) + 1000000000,
        "balance": req.body.balance,
        "password": req.body.password,

        "accountDetails": {
            "name": req.body.name,
            "email": req.body.email,
            "phone": req.body.phone,
            "address": req.body.address
        },

        "transactions": {}
    }


    listing.password = CryptoJS.SHA256(listing.password).toString();
    var hash = listing.password;
    info = {
        "_id": listing._id,
        "name": listing.accountDetails.name,
        "email": listing.accountDetails.email,
        "balance": listing.balance
    }

    listing.password = CryptoJS.AES.encrypt(listing.password, hash).toString();
    listing.accountDetails.name = CryptoJS.AES.encrypt(listing.accountDetails.name, hash).toString();
    listing.accountDetails.email = CryptoJS.AES.encrypt(listing.accountDetails.email, hash).toString();
    listing.accountDetails.phone = CryptoJS.AES.encrypt(listing.accountDetails.phone, hash).toString();
    listing.accountDetails.address = CryptoJS.AES.encrypt(listing.accountDetails.address, hash).toString();

    console.log(listing);
    await createListing(listing, "UserDB");

    res.redirect('/NewUser/' + CryptoJS.SHA256(info._id));
});

app.get('/NewUser/:a', async (req, res) => {
    res.render(__dirname + '/Views/userredirect.ejs', {
        info: info
    })
})


//Transaction 

app.post('/Transaction/:a', async (req, res) => {
    console.log(req.body);
    var RecAcc = parseInt(req.body.reciever);
    var RecObj = await find({_id: RecAcc}, "UserDB");


    if (RecObj == null) {
        console.log("Null");
        res.render(__dirname + '/Views/userAccount.ejs', {
            info:obj,
            status: "Please verify account number",
            classVal:"error"
        })
    } else {
        
        await update(parseInt(req.params.a),RecObj, parseInt(req.body.amount));
        console.log("Transaction ended");
        res.render(__dirname + '/Views/userAccount.ejs', {
            info:obj,
            status: "Transaction succesful",
            classVal:"Succuseful"
        })
    }

})

//View transactions

app.get('/ViewTransactions/:a', async (req,res)=>{
    var AccObj = await find({ "_id": parseInt(req.params.a)},"UserDB");
    var transactions = AccObj.transactions;
    
    var len = Object.keys(transactions).length;
    for(i=0;i<len;i++){
        transactions[i].sender = CryptoJS.AES.decrypt(transactions[i].sender, commonKey).toString(enc.Utf8);
        transactions[i].reciever = CryptoJS.AES.decrypt(transactions[i].reciever, commonKey).toString(enc.Utf8);
        transactions[i].amount = CryptoJS.AES.decrypt(transactions[i].amount, commonKey).toString(enc.Utf8);
    }
    
    console.log(transactions);
    res.render(__dirname+'/Views/ViewTransactions.ejs',{
        transactions:transactions,
        len:len,
        sender:AccObj._id
    });
})

app.listen(process.env.PORT || 5000);