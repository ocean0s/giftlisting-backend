const express = require("express") 
const database = require("../database")

let routerPresents = express.Router()

routerPresents.post("/", async (req, res) => {
    let errors = []
    let { email } = req.infoApiKey
    let name = req.body.name
    let description = req.body.description
    let url = req.body.url
    let listName = req.body.listName
    let price = req.body.price
    if (name == undefined || name == "")
       errors.push({ error: "Invalid format for name" })
    if (listName == undefined || listName == "")
       errors.push({ error: "Invalid format for listName" })
    if (description == undefined || description == "")
        errors.push({ error: "Invalid format for description" })
    if (url == undefined || url == "")
        errors.push({ error: "Invalid format for url" })
    if (price == undefined || price == "" || isNaN(price))
        errors.push({ error: "Invalid format for price" })
    
    price = parseFloat(price)
    if (price < 0)
        errors.push({ error: "Price cannot be negative" })

    if (errors.length != 0)
        return res.status(400).json({ error: errors })

    database.connect()
    let userId
    try {
        userId = await database.query( // change DB to fit query
            "SELECT id FROM users WHERE email = ?", 
            [email])
    } catch (e) {
        return res.status(500).json({ error: "Error during user query" })
    }

    if (userId.length != 1 || userId[0].id == undefined) {
        return res.status(400).json({error: "No id associated with the email found in the API key"})
    }

    // verificacion lista existe?
    let isList
    try {
        isList = await database.query(
            "SELECT COUNT(*) as count FROM lists WHERE userId = ? AND listName = ?",
            [userId[0].id, listName]
        )
    } catch (e) {
        database.disconnect()
        return res.status(500).json({ error: "Error during list query" })
    }

    // creacion si no existe
    if (isList[0].count != 1) {
        try {
            await database.query(
                "INSERT INTO lists (userId, listName) VALUES (?, ?)",
                [userId[0].id, listName]
            )
        } catch (e) {
            console.log(e)
            database.disconnect()
            return res.status(500).json({ error: "Error during list creation" })
        }
    }

    try {
        await database.query(
            "INSERT INTO presents (userId, name, description, url, price, listName) VALUES (?, ?, ?, ?, ?, ?)", 
            [userId[0].id, name, description, url, price, listName])
    } catch (e) {
        return res.status(500).json({ error: "Error during creation" })
    } finally {
        database.disconnect()
    }

    return res.json({created: true})
})

routerPresents.get("/", async (req, res) => {
    let { email } = req.infoApiKey 
    let userEmail = req.query.userEmail

    if (userEmail == email)
        return res.status(400).json({ error: "Email in query cannot be yours" })

    database.connect()
    let presents
    if (userEmail == undefined) {
        try {
            // la query se hace por email ya que es lo que indica el enunciado
            presents = await database.query(  
            "SELECT p.id, p.name, p.description, p.url, p.price, p.listName, p.chosenBy " +
                "FROM presents p, users u " + 
                "WHERE u.email = ? AND u.id = p.userId ",
                [email])
        } catch (e) {
            return res.status(500).json({ error: "Error during presents query" })
        } finally {
            database.disconnect()
        }
    } else {
        if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(userEmail))
            return res.status(400).json({ error: "Invalid format for email" })
        let isFriend
        try {
            isFriend = await database.query(
                "SELECT COUNT(*) as count " +
                "FROM friends " + 
                "WHERE emailMainUser = ? AND emailFriend = ? ",
                [userEmail, email])
        } catch (e) {
            database.disconnect()
            return res.status(500).json({ error: "Error during friend query" })
        } 

        if (isFriend[0].count < 1) {
            database.disconnect()
            return res.status(401).json({ error: "Present owner has not added you to their friend list" })
        }

        try {
            presents = await database.query(  
                "SELECT p.id, p.name, p.description, p.url, p.price, p.listName, p.chosenBy " +
                "FROM presents p, users u " + 
                "WHERE u.email = ? AND u.id = p.userId AND p.listName IN " + 
                "(SELECT listName FROM friends WHERE emailMainUser = ? AND emailFriend = ?) ",
                [userEmail, userEmail, email])
            } catch (e) {
            return res.status(500).json({ error: "Error during presents query" })
        } finally {
            database.disconnect()
        }
    }
    return res.json({ presents: presents })
})

routerPresents.get("/gifting", async (req, res) => {
    let { email } = req.infoApiKey 

    database.connect()
    let presents
        try {
            presents = await database.query(  
            "SELECT p.id, p.name, p.description, p.url, p.price, p.listName, u.email " +
                "FROM presents p, users u " + 
                "WHERE p.chosenBy = ? AND p.userId = u.id",
                [email])
        } catch (e) {
            return res.status(500).json({ error: "Error during presents query" })
        } finally {
            database.disconnect()
        }
    return res.json({ presents: presents })
})

routerPresents.get("/:id", async (req, res) => {
    let { userId } = req.infoApiKey
    let id = req.params.id
    if (id == undefined)
        return res.status(400).json({ error: "No id provided as parameter" })

    database.connect()
    let present
    try {
        present = await database.query(
            "SELECT name, description, url, price, listName, chosenBy " +
            "FROM presents " + 
            "WHERE userId = ? AND id = ? ",
            [userId, id])
    } catch (e) {
        return res.status(500).json({ error: "Error during query" })
    } finally {
        database.disconnect()
    }

    if (present.length != 1)
        return res.status(400).json({ error: "None of your presents is associated with this ID" })

    return res.json({ present })
})

routerPresents.delete("/:id", async (req, res) => {
    let { userId } = req.infoApiKey
    let id  = req.params.id
    if (id == undefined)
        return res.status(400).json({ error: "No id provided as parameter" })

    database.connect()
    let isOwner
    try {
        isOwner = await database.query(
            "SELECT COUNT(*) AS count " +
            "FROM presents " + 
            "WHERE userId = ? AND id = ? ",
            [userId, id])
    } catch (e) {
        database.disconnect()
        return res.status(500).json({ error: "Error during query" })
    } 
    
    if (isOwner[0].count != 1) {
        database.disconnect()
        return res.status(400).json({ error: "None of your presents is associated with this ID" })
    }

    try {
        await database.query(
            "DELETE FROM presents " +
            "WHERE id = ? ",
            [id])
    } catch (e) {
        return res.status(500).json({ error: "Error during deletion" })
    } finally {
        database.disconnect()
    }

    return res.json({ deleted: true })
})

routerPresents.put("/:id", async (req, res) => {
    let { userId } = req.infoApiKey
    let id  = req.params.id
    if (id == undefined)
        return res.status(400).json({ error: "No id provided as parameter" })
    
    database.connect()
    let isOwner
    try {
        isOwner = await database.query(
            "SELECT COUNT(*) AS count " +
            "FROM presents " + 
            "WHERE userId = ? AND id = ? ",
            [userId, id])
    } catch (e) {
        database.disconnect()
        return res.status(500).json({ error: "Error during ownership query" })
    } 
    if (isOwner[0].count != 1) { // is not owner route
        let { email } = req.infoApiKey
        let present
        try {
            present = await database.query(
                "SELECT p.name, p.description, u.email, p.listName, p.chosenBy " +
                "FROM presents p, users u " + 
                "WHERE p.id = ? AND p.userId = u.id ",
                [id])
        } catch (e) {
            database.disconnect()
            return res.status(500).json({ error: "Error during present query" })
        } 

        if (present.length != 1) {
            database.disconnect()
            return res.status(400).json({ error: "There is no present associated to this id" })
        }

        if (email == present[0].email){ // shouldnt enter because if same -> modification flow
            database.disconnect()
            return res.status(400).json({ error: "Cannot choose your own gift" })
        }

        let isFriend
        try {
            isFriend = await database.query(
                "SELECT COUNT(*) as count " +
                "FROM friends " + 
                "WHERE emailMainUser = ? AND emailFriend = ? AND listName = ? ",
                [present[0].email, email, present[0].listName])
        } catch (e) {
            database.disconnect()
            return res.status(500).json({ error: "Error during friend query" })
        } 

        if (isFriend[0].count != 1) {
            database.disconnect()
            return res.status(401).json({ error: "Present owner has not added you to the present's friend list" })
        }

        if (present[0].chosenBy != null) {
            database.disconnect()
            return res.status(400).json({ error: "This present has already been chosen by someone"})
        }

        try {
            await database.query(
                "UPDATE presents " +
                "SET chosenBy = ? " +
                "WHERE id = ? ",
                [email, id])
        } catch (e) {
            return res.status(500).json({ error: "Error during chosen update" })
        } finally {
            database.disconnect()
        }
    
        return res.json({ chosen: true })
    } 
    // is owner route
    let name = req.body.name
    let description = req.body.description
    let url = req.body.url
    let price = req.body.price
    let listName = req.body.listName
    let errors = []
    if (name == undefined || name == "")
        errors.push({ error: "Invalid format for name" })
    if (listName == undefined || listName == "")
        errors.push({ error: "Invalid format for list" })
    if (description == undefined || description == "")
        errors.push({ error: "Invalid format for description" })
    if (url == undefined || url == "")
        errors.push({ error: "Invalid format for url" })
    if (price == undefined || price == "" || isNaN(price))
        errors.push({ error: "Invalid format for price" })
     
     price = parseFloat(price)
    if (price < 0)
        errors.push({ error: "Price cannot be negative" })
 
    if (errors.length != 0) {
        database.disconnect()
        return res.status(400).json({ error: errors }) 
    }

    let isList
    try {
        isList = await database.query(
            "SELECT COUNT(*) as count FROM lists WHERE userId = ? AND listName = ?",
            [userId, listName]
        )
    } catch (e) {
        database.disconnect()
        return res.status(500).json({ error: "Error during list query" })
    }

    // creacion si no existe
    if (isList[0].count != 1) {
        try {
            await database.query(
                "INSERT INTO lists (userId, listName) VALUES (?, ?)",
                [userId, listName]
            )
        } catch (e) {
            database.disconnect()
            return res.status(500).json({ error: "Error during list creation" })
        }
    }
    
    try {
        await database.query(
            "UPDATE presents " +
            "SET name = ?, description = ?, url = ?, price = ?, listName = ? " +
            "WHERE id = ? ",
            [name, description, url, price, listName, id])
    } catch (e) {
        return res.status(500).json({ error: "Error during update" })
    } finally {
        database.disconnect()
    }

    return res.json({ modified: true })
})


module.exports = routerPresents