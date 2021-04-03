// const admin = require("firebase-admin");
let user = undefined;

document.addEventListener("DOMContentLoaded", (event) => {
  mdc.ripple.MDCRipple.attachTo(document.querySelector(".login-button"));

  // const app = admin.initializeApp({
  //   credential: admin.credential.applicationDefault(),
  //   databaseURL: "https://firebasics-c10aa.firebaseio.com",
  // });

  const app = firebase.app();
  const db = firebase.firestore();

  const posts = db.collection("posts");
  const myPost = posts.doc("olusXjWwLZ8QvyoFkuPm");

  // myPost.get().then((doc) => {
  //   const data = doc.data();
  //   document.write(`<h1>${data.title}</h1>`);
  //   document.write(`<p>${data.message}</p>`);
  // });

  myPost.onSnapshot((doc) => {
    const data = doc.data();
    document.querySelector("#title").innerText = data.title;
    document.querySelector("#message").innerText = data.message;
  });
});

function updatePost(e) {
  const db = firebase.firestore();
  const posts = db.collection("posts");
  const myPost = posts.doc("olusXjWwLZ8QvyoFkuPm");

  myPost.update({ message: e.target.value });
}

function uploadFile(files) {
  const storageRef = firebase.storage().ref();
  const horseRef = storageRef.child("horse.jpg");

  const file = files.item(0);

  const task = horseRef.put(file);

  task.then((snapshot) => {
    console.log(snapshot);
    snapshot.ref.getDownloadURL().then((downloadURL) => {
      const url = downloadURL;
      document.querySelector("#imgUpload").setAttribute("src", url);
    });
  });
}

function googleLogin(e) {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase
    .auth()
    .signInWithPopup(provider)
    .then((result) => {
      user = result.user;
      document.querySelector(
        "#greeting"
      ).innerText = `Welcome ${user.displayName}!`;
      document.querySelector(".login-button").style.display = "none";
    })
    .catch(console.log);
}
