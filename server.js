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

// Route pour recevoir les demandes de connexion
/*app.post("/connexion", (req, res) => {
  const { random_id } = req.body;

  // Rechercher les informations de l'ordinateur dans la base de données
  getComputerInfo(random_id)
    .then((computerInfo) => {
      if (computerInfo) {
        const { nom_pc } = computerInfo;

        // Envoyer la demande de connexion à l'adresse IP du destinataire via WebSocket
        sendConnectionRequest(nom_pc, random_id)
          .then(() => {
            res.json({
              message: "Demande de connexion envoyée avec succès.",
            });
          })
          .catch((error) => {
            console.error(
              "Erreur lors de l'envoi de la demande de connexion :",
              error
            );
            res.status(500).json({
              error:
                "Une erreur est survenue lors de l'envoi de la demande de connexion.",
            });
          });
      } else {
        res.status(404).json({ error: "ID d'ordinateur non trouvé." });
      }
    })
    .catch((error) => {
      console.error(
        "Erreur lors de la recherche des informations d'ordinateur :",
        error
      );
      res.status(500).json({
        error:
          "Une erreur est survenue lors de la recherche des informations d'ordinateur.",
      });
    });
});*/

/* // Envoyer la demande de connexion à l'adresse IP du destinataire via WebSocket
        sendConnectionRequest(nom_pc, random_id)
          .then(() => {
            // Enregistrer les informations de connexion du client initiateur
            registerConnectionInitiator(initiateur_random_id, ID, destinataire)
              .then(() => {
                res.json({
                  message: "Demande de connexion envoyée avec succès.",
                });
              })
              .catch((error) => {
                console.error(
                  "Erreur lors de l'enregistrement des informations de connexion :",
                  error
                );
                res.status(500).json({
                  error:
                    "Une erreur est survenue lors de l'enregistrement des informations de connexion.",
                });
              });
          })
          .catch((error) => {
            console.error(
              "Erreur lors de l'envoi de la demande de connexion :",
              error
            );
            res.status(500).json({
              error:
                "Une erreur est survenue lors de l'envoi de la demande de connexion.",
            });
          });
      } else {
        res.status(404).json({ error: "ID d'ordinateur non trouvé." });
      }
    })
    .catch((error) => {
      console.error(
        "Erreur lors de la recherche des informations d'ordinateur :",
        error
      );
      res.status(500).json({
        error:
          "Une erreur est survenue lors de la recherche des informations d'ordinateur.",
      });
    });
});*/

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

// Fonction pour envoyer une demande de connexion à l'adresse IP spécifiée
function sendConnectionRequest(destinataireName, initiateurName) {
  return new Promise((resolve, reject) => {
    // Rechercher la connexion WebSocket du destinataire
    const destinataire = clients.get(destinataireName);

    if (destinataire) {
      // Envoyer la demande de connexion au destinataire via WebSocket
      destinataire.send(
        JSON.stringify({ type: "connectionRequest", initiateurName })
      );
      resolve();
    } else {
      reject(new Error(`Le client ${destinataireName} n'est pas connecté.`));
    }
  });
}

// Fonction pour enregistrer les informations de connexion de l'initiateur
/*function registerConnectionInitiator(initiatorName, ID, destinataireName) {
  return new Promise((resolve, reject) => {
    // Enregistrer les informations de connexion de l'initiateur dans la base de données
    const query =
      "INSERT INTO Connexion (initiateur_nom, initiateur_id, destinataire_nom) VALUES (?, ?, ?)";
    connection.query(
      query,
      [initiatorName, ID, destinataireNom],
      (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}*/

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
          const { receiverId, senderName } = data.data;
          handleConnectionRequest(receiverId, senderName);
          break;
        case "connectionResponse":
          // Gérer la réponse du destinataire à la demande de connexion
          handleConnectionResponse(data.initiateurName, data.accepted);
          break;
        case "screenShareRequest":
          // Gérer la demande de partage d'écran
          handleScreenShareRequest(clientName, data.ID);
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
function handleConnectionRequest(receiverId, senderName) {
  // Rechercher les informations de connexion de l'initiateur dans la base de données
  getConnectionReceiverInfo(receiverId)
    .then((receiverInfo) => {
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
        /*const { initiateur_nom, destinataire_nom } = initiatorInfo;

        // Envoyer la réponse de connexion à l'adresse IP de l'initiateur via WebSocket
        sendConnectionResponse(initiateur_nom, accepted)
          .then(() => {
            // Mettre à jour l'état de la connexion dans la base de données
            updateConnectionStatus(ID, accepted)
              .then(() => {
                console.log(
                  `Connexion ${
                    accepted ? "acceptée" : "refusée"
                  } pour l'ID ${ID}`
                );
              })
              .catch((error) => {
                console.error(
                  "Erreur lors de la mise à jour de l'état de la connexion :",
                  error
                );
              });
          })
          .catch((error) => {
            console.error(
              "Erreur lors de l'envoi de la réponse de connexion :",
              error
            );
          });

        // Si la connexion est acceptée, démarrer le partage d'écran
        if (accepted) {
          startScreenSharing(destinataire_nom, initiateur_nom);
        }*/
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

// Fonction pour mettre à jour l'état de la connexion dans la base de données
function updateConnectionStatus(ID, accepted) {
  return new Promise((resolve, reject) => {
    const query = "UPDATE Connexion SET acceptee = ? WHERE initiateur_id = ?";
    connection.query(query, [accepted, ID], (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// Fonction pour récupérer les informations de connexion du receveur
function getConnectionReceiverInfo(receiverId) {
  return new Promise((resolve, reject) => {
    const query = "SELECT nom_pc FROM Client WHERE random_id = ?";
    connection.query(query, [receiverId], (err, result) => {
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
