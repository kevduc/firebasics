const FileSizeLimit = 300 * 1024
const TitleLengthMax = 50
const MessageLengthMax = 100

let user = null
let pictureSpinner = null
let snackbar = {
  loggedOut: null,
  loggedOutError: null,
  pictureTooBig: null,
}
let cardMedia = null
let postUnsubscribe = null

const initializeMDC = (MDCClass, query) => Array.from(document.querySelectorAll(query)).map((el) => new MDCClass(el))

const hyphenate = (txt) => txt.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)

document.addEventListener('DOMContentLoaded', (event) => {
  cardMedia = document.querySelector('.my-card__media')
  setLoggedIn(false)

  const buttonRipples = initializeMDC(mdc.ripple.MDCRipple, '.mdc-button, .mdc-icon-button, .mdc-card__primary-action')
  const textFields = initializeMDC(mdc.textField.MDCTextField, '.mdc-text-field')
  const topBar = initializeMDC(mdc.topAppBar.MDCTopAppBar, '.mdc-top-app-bar')
  pictureSpinner = initializeMDC(mdc.circularProgress.MDCCircularProgress, '.picture-spinner')[0]
  pictureSpinner.foundation.setDeterminate(false)

  Object.keys(snackbar).forEach((key) => {
    snackbar[key] = initializeMDC(mdc.snackbar.MDCSnackbar, `.${hyphenate(key)}-snackbar`)[0]
  })

  // const app = admin.initializeApp({
  //   credential: admin.credential.applicationDefault(),
  //   databaseURL: "https://firebasics-c10aa.firebaseio.com",
  // });

  const app = firebase.app()
})

function googleLogin() {
  const provider = new firebase.auth.GoogleAuthProvider()

  firebase
    .auth()
    .signInWithPopup(provider)
    .then((result) => {
      user = result.user
      setLoggedIn(true)

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
        postUnsubscribe = myPost.onSnapshot((doc) => updateCaption(doc.data()))
      })

      firebase
        .storage()
        .ref()
        .child(`${user.uid}`)
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

function logout() {
  firebase
    .auth()
    .signOut()
    .then(() => {
      postUnsubscribe()
      user = null
      setLoggedIn(false)
      snackbar.loggedOut.open()
    })
    .catch((error) => {
      console.error(error)
      snackbar.loggedOutError.open()
    })
}

function setLoggedIn(tf) {
  document.querySelector('#greeting').innerText = tf ? `Welcome ${user.displayName}!` : `Hi, please login!`
  document.querySelector('.login-button').style.display = tf ? 'none' : 'initial'
  document.querySelector('.logout-button').style.display = tf ? 'initial' : 'none'
  document.querySelector('.user-content').style.display = tf ? 'initial' : 'none'
  if (tf === false) {
    cardMedia.style = ''
    updateCaption({ title: '', message: '' })
  }
}

function updateCaption(data) {
  document.querySelector('#title').innerText = data.title
  document.querySelector('#message').innerText = data.message
}

function updatePicture(url) {
  cardMedia.style.backgroundImage = `url("${url}")`
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

  myPost.update({ message: message.slice(0, MessageLengthMax) })
}

function updateTitle(title) {
  if (user === null) return

  const db = firebase.firestore()
  const myPost = db.collection('posts').doc(user.uid)

  myPost.update({ title: title.slice(0, TitleLengthMax) })
}

function formatFileSize(number) {
  const unit = 'B'
  let prefixes = ['', 'K', 'M', 'G']

  let powers = Object.keys(prefixes).map((p) => Math.pow(1024, p))
  let rank = powers.reduce((rank, threshold) => rank + (number >= threshold), -1)
  let value = number / powers[rank]

  return `${value.toFixed(1 - (value >= 10))}${prefixes[rank]}${unit}`
}

function updateFileSize(size) {
  document.querySelector('.file-size').innerText = size > 0 ? formatFileSize(size) : ''
}

function uploadFile(files) {
  updateFileSize(0)
  document.querySelector('.file-size').classList.remove('too-big')

  if (user === null || files.length === 0) return

  const storageRef = firebase.storage().ref()
  const imageRef = storageRef.child(`${user.uid}`)

  const file = files.item(0)
  updateFileSize(file.size)

  if (file.size > FileSizeLimit) {
    document.querySelector('.file-size').classList.add('too-big')
    snackbar.pictureTooBig.open()
    return
  }

  setPictureLoading(true)
  const task = imageRef.put(file)

  task
    .then((snapshot) => {
      snapshot.ref.getDownloadURL().then((url) => {
        updatePicture(url)

        const parts = file.name.split(/\.([^\.]*)$/, 2)
        updateMessage(`${parts[0].slice(0, MessageLengthMax - 2 - parts[1].length)}….${parts[1]}`)
      })
    })
    .catch((error) => {
      console.error(error)
    })
    .finally(() => {
      setPictureLoading(false)
    })
}
