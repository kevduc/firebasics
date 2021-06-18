let user = null
let pictureSpinner = null
let cardMedia = null

const initializeMDC = (MDCClass, query) => Array.from(document.querySelectorAll(query)).map((el) => new MDCClass(el))

document.addEventListener('DOMContentLoaded', (event) => {
  const buttonRipples = initializeMDC(mdc.ripple.MDCRipple, '.mdc-button, .mdc-icon-button, .mdc-card__primary-action')
  const textFields = initializeMDC(mdc.textField.MDCTextField, '.mdc-text-field')
  const topBar = initializeMDC(mdc.topAppBar.MDCTopAppBar, '.mdc-top-app-bar')
  pictureSpinner = initializeMDC(mdc.circularProgress.MDCCircularProgress, '.picture-spinner')[0]
  pictureSpinner.foundation.setDeterminate(false)

  cardMedia = document.querySelector('.my-card__media')

  // const app = admin.initializeApp({
  //   credential: admin.credential.applicationDefault(),
  //   databaseURL: "https://firebasics-c10aa.firebaseio.com",
  // });

  const app = firebase.app()
})

function googleLogin(e) {
  const provider = new firebase.auth.GoogleAuthProvider()

  firebase
    .auth()
    .signInWithPopup(provider)
    .then((result) => {
      user = result.user
      document.querySelector('#greeting').innerText = `Welcome ${user.displayName}!`
      document.querySelector('.login-button').style.display = 'none'
      document.querySelector('.user-content').style.display = 'initial'
      setPictureLoading(true)

      const db = firebase.firestore()
      const myPost = db.collection('posts').doc(user.uid)

      myPost.get().then((doc) => {
        let data = doc.data()

        if (!doc.exists || !data.title || !data.message) {
          data = Object.assign(
            {
              title: 'A Picture',
              message: '',
            },
            data
          )
          myPost.set(data, { merge: true })
        }

        updateCaption(data)
        myPost.onSnapshot((doc) => updateCaption(doc.data()))
      })

      firebase
        .storage()
        .ref()
        .child(`${user.uid}.jpg`)
        .getDownloadURL()
        .then((url) => updatePicture(url))
        .catch((error) => {
          setNoPicture(true)

          switch (error.code) {
            case 'storage/object-not-found':
              console.warn('User Picture not found')
              break

            default:
              console.error(error)
              break
          }
        })
        .finally(() => setPictureLoading(false))
    })
    .catch(console.log)
}

function updateCaption(data) {
  document.querySelector('#title').innerText = data.title
  document.querySelector('#message').innerText = data.message
}

function updatePicture(url) {
  cardMedia.style = `background-image: url("${url}")`
  setNoPicture(false)
}

function setNoPicture(tf) {
  cardMedia.classList[tf ? 'add' : 'remove']('no-picture')
}

function setPictureLoading(tf) {
  document.querySelector('.my-card__media-content').classList[tf ? 'add' : 'remove']('loading')
  tf ? pictureSpinner.open() : pictureSpinner.close()
}

function updateMessage(message) {
  if (user === null) return

  const db = firebase.firestore()
  const myPost = db.collection('posts').doc(user.uid)

  myPost.update({ message })
}

function updateTitle(title) {
  if (user === null) return

  const db = firebase.firestore()
  const myPost = db.collection('posts').doc(user.uid)

  myPost.update({ title })
}

function uploadFile(files) {
  if (user === null || files.length === 0) return

  setPictureLoading(true)
  const storageRef = firebase.storage().ref()
  const imageRef = storageRef.child(`${user.uid}.jpg`)

  const file = files.item(0)

  const task = imageRef.put(file)

  task
    .then((snapshot) => {
      snapshot.ref.getDownloadURL().then((url) => {
        updatePicture(url)
        updateMessage(file.name)
      })
    })
    .catch((error) => {
      console.error(error)
    })
    .finally(() => {
      setPictureLoading(false)
    })
}
