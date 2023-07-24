const admin = require('firebase-admin');
const collections = require('../src/constants/collections');

// Configure Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),
    storageBucket: 'gs://monymarket-7aca4.appspot.com',
});

let ignoredFirst = false;

function listenForChanges(collection) {
    admin.firestore().collection(collection).onSnapshot(
        async(querySnapshot) => {
            const changes = querySnapshot.docChanges();

            if (!ignoredFirst) {
                console.log("Started Listening for changes in 'Chat' collection... ");
                ignoredFirst = true;
                return;
            }

            await Promise.all(
                changes.map(async(docRef) => {
                    const { lastMessage } = docRef.doc.data();

                    const receiverRef = await admin.firestore().collection(collections.user)
                        .doc(lastMessage.toID);
                    const senderRef = await admin.firestore().collection(collections.user)
                        .doc(lastMessage.fromID);
                    const receiverDoc = await receiverRef.get();
                    const senderDoc = await senderRef.get();

                    if (!receiverDoc.exists && !senderRef.exists) {
                        if (!senderRef.exists) console.error('Invalid sender ID');
                        if (!receiverDoc.exists) console.error('Invalid receiver ID');
                        return null;
                    }

                    const receiverData = await receiverDoc.data();
                    const senderData = await senderDoc.data();

                    const notification = {
                        data: {
                            fromID: lastMessage.toID,
                            sender_name: senderData.displayName,
                            toID: lastMessage.fromID,
                            receiver_name: receiverData.displayName,
                            timestamp: lastMessage.timestamp.toString(),
                            messageId: lastMessage.messageId,
                            isRead: lastMessage.isRead.toString(),
                            type: lastMessage.type,
                        },
                        notification: {
                            title: `${senderData.displayName} has sent you a message`,
                            body: lastMessage.content,
                        },
                        token: receiverData.token,
                    };

                    console.log(`Sending notification to user: ${receiverData.displayName} with token: ${receiverData.token}`);
                    const response = await admin.messaging().send(notification);
                    console.log('Firebase Response: ', response);

                    return null;
                }),
            );
        },
    );
}

listenForChanges(collections.chat);