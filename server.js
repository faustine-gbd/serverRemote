const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const bcrypt = require("bcrypt");
const WebSocket = require("ws");

const app = express();
const port = 8000;
const wsPort = 8081;

// Configurer les détails de connexion à la base de données MySQL
const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "DEMONS",
});

// Middleware pour analyser les corps de requête au format JSON
app.use(bodyParser.json());

// Créer le serveur WebSocket
const wss = new WebSocket.Server({ port: wsPort });

// Stocker les informations de connexion des clients
const clients = new Map();

// Route pour recevoir la demande d'identifiants
app.post("/demande-identifiants", (req, res) => {
  const { nom_pc } = req.body.clientInfo;

  console.log("Requête de demande d'identifiants reçue : ", nom_pc);

  // Générer un ID unique pour ce client
  const generatedId = generateId();

  // Enregistrer l'ID et le nom de l'ordinateur dans la base de données
  insertClientInfo(generatedId, nom_pc)
    .then(() => {
      // Envoyer l'ID dans la réponse
      res.json({ random_id: generatedId });
    })
    .catch((error) => {
      console.error(
        "Erreur lors de l'enregistrement des données dans la base de données :",
        error
      );
      res.status(500).json({
        error: "Une erreur est survenue lors de l'enregistrement des données.",
      });
    });
});

// Fonction pour générer un ID unique
function generateId() {
  return Math.floor(Math.random() * 1000000) + 1;
}

// Fonction pour insérer les informations du client dans la base de données
function insertClientInfo(generatedId, nomPc) {
  return new Promise((resolve, reject) => {
    const query = "INSERT INTO Client (random_id, nom_pc) VALUES (?, ?)";
    connection.query(query, [generatedId, nomPc], (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// Fonction pour récupérer les informations de l'ordinateur depuis la base de données
function getComputerInfo(randomId) {
  return new Promise((resolve, reject) => {
    const query = "SELECT nom_pc, random_id FROM Client WHERE random_id = ?";
    connection.query(query, [randomId], (err, result) => {
      if (err) {
        reject(err);
      } else {
        if (result.length > 0) {
          resolve(result[0]);
        } else {
          resolve(null);
        }
      }
    });
  });
}


// Gérer les connexions entrantes sur le serveur WebSocket
wss.on("connection", (ws, req) => {
  // Gérer les messages reçus du client
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      switch (data.type) {
        case "register":
          const clientName = data.nomPc;
          clients.set(clientName, ws);
          console.log(`Nouvelle connexion depuis ${clientName}`);
          break;
        case "connexion-request-from-sender":
          console.log(`Demande de connexion :  ${data}`);
          handleConnectionRequest(data.data);
          break;
        case "connexion-request-response":
          console.log(`Retour :  ${data}`);
          handleConnexionRequestResponse(data.data);
          break;
        case "offer-from-sender":
          console.log('routing offer')
          // send to the electron app
          handleOffer(data.data)
          break;
        case "answer":
          console.log('routing answer')
          // send to the electron app
          handleAnswer(data.data)
          break;
        case "ice-candidate":
          console.log('ice-candidate : ', data.data)
          ws.send(JSON.stringify({ type: 'ice-candidate', candidate: data.candidate }))
          break;
        case "control":
          handleControl(data.data)
          break;
        // Ajoutez d'autres types de messages si nécessaire
        default:
          console.error(`Type de message inconnu: ${data.type}`);
      }
    } catch (error) {
      console.error(`Erreur lors du traitement du message: ${error}`);
    }
  });

  // Gérer la déconnexion du client
  ws.on("close", () => {
    console.log(`Client  déconnecté`);
    clients.delete(clientName);
  });
});

// Fonction pour gérer la réponse du destinataire à la demande de connexion
function handleConnectionRequest(data) {
  const { receiverId, senderName } = data;
  // Rechercher les informations de connexion de l'initiateur dans la base de données
  getClientInfo(receiverId).then((receiverInfo) => {
      if (receiverInfo) {
        console.log("receiverInfo :", receiverInfo);
        const { nom_pc } = receiverInfo;
        const receiverWs = clients.get(nom_pc);
        receiverWs.send(
          JSON.stringify({
            type: "connexion-request-to-receiver",
            data: {
              receiverName: nom_pc,
              senderName,
            },
          })
        );
      } else {
        console.error(
          `Impossible de trouver les informations de connexion pour l'ID ${ID}`
        );
      }
    })
    .catch((error) => {
      console.error(
        "Erreur lors de la recherche des informations de connexion :",
        error
      );
    });
}
function handleConnexionRequestResponse(data) {
  const { receiverName, senderName, requestAccepted } = data;
  const senderWs = clients.get(senderName)
  senderWs.send(JSON.stringify({ type: 'connexion-request-response', data: {receiverName, senderName, requestAccepted} }));
}

function handleOffer(data) {
  const { receiverId, senderName, offer } = data;
  const senderWs = clients.get(senderName)
  senderWs.send(JSON.stringify({ type: 'offer', data: {receiverId, senderName, offer} }));
}

function handleAnswer(data) {
  const { receiverId, senderName, answer } = data;
  const senderWs = clients.get(senderName)
  senderWs.send(JSON.stringify({ type: 'answer', data: {receiverId, senderName, answer} }));
}

function handleControl(data) {
  const { receiverId, senderName, answer } = data;
  const senderWs = clients.get(senderName)
  senderWs.send(JSON.stringify({ type: 'control', data }));
}

// Fonction pour envoyer la réponse de connexion à l'adresse IP de l'initiateur
function sendConnectionResponse(initiatorName, accepted) {
  return new Promise((resolve, reject) => {
    // Rechercher la connexion WebSocket de l'initiateur
    const initiateur = clients.get(initiatorName);

    if (initiateur) {
      // Envoyer la réponse de connexion à l'initiateur via WebSocket
      initiateur.send(JSON.stringify({ type: "connectionResponse", accepted }));
      resolve();
    } else {
      reject(
        new Error(
          `Impossible d'envoyer la réponse de connexion, l'initiateur ${initiatorName} n'est pas connecté.`
        )
      );
    }
  });
}


// Fonction pour récupérer les informations de connexion du receveur
function getClientInfo(clientId) {
  return new Promise((resolve, reject) => {
    const query = "SELECT nom_pc FROM Client WHERE random_id = ?";
    connection.query(query, [clientId], (err, result) => {
      if (err) {
        reject(err);
      } else {
        if (result.length > 0) {
          resolve(result[0]);
        } else {
          resolve(null);
        }
      }
    });
  });
}

// Fonction pour démarrer le partage d'écran
function startScreenSharing(destinataireNom, initiatorNom) {
  // Implémentez la logique pour capturer l'écran du destinataire et l'envoyer à l'initiateur via WebSocket
  // Cela peut impliquer l'utilisation de bibliothèques comme 'node-screenshot-desktop' ou 'desktop-capturer' (pour Electron)
  console.log(
    `Démarrage du partage d'écran entre ${destinataireNom} et ${initiatorNom}`
  );
}

// Démarrer le serveur
app.listen(port, () => {
  console.log(`Serveur démarré sur le port ${port}`);
});
