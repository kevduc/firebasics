const FileSizeLimit = 300 * 1024
const TitleLengthMax = 50
const MessageLengthMax = 100

let user = null
let pictureSpinner = null
let snackbar = {
  loggedOut: null,
  loggedOutError: null,
  loginError: null,
  pictureTooBig: null,
  wrongFileType: null,
  genericError: null,
}
let cardMedia = null
let cardUpdatesUnsubscribe = null
let originalGreeting = null

const initializeMDC = (MDCClass, query) => Array.from(document.querySelectorAll(query)).map((el) => new MDCClass(el))

const hyphenate = (txt) => txt.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)

document.addEventListener('DOMContentLoaded', (event) => {
  cardMedia = document.querySelector('.my-card__media')
  originalGreeting = document.querySelector('#greeting').innerHTML
  setLoggedIn(false)

  const buttonRipples = initializeMDC(mdc.ripple.MDCRipple, '.mdc-button, .mdc-icon-button, .mdc-card__primary-action')
  const textFields = initializeMDC(mdc.textField.MDCTextField, '.mdc-text-field')
  const topBar = initializeMDC(mdc.topAppBar.MDCTopAppBar, '.mdc-top-app-bar')
  pictureSpinner = initializeMDC(mdc.circularProgress.MDCCircularProgress, '.picture-spinner')[0]
  pictureSpinner.foundation.setDeterminate(false)

  Object.keys(snackbar).forEach((key) => {
    snackbar[key] = initializeMDC(mdc.snackbar.MDCSnackbar, `.${hyphenate(key)}-snackbar`)[0]
  })

  const app = firebase.app()
})

const getUserCardDataRef = (userId) => firebase.firestore().collection('cards').doc(userId)
const getUserCardImageRef = (userId) => firebase.storage().ref().child(`${userId}`)

function googleLogin() {
  const provider = new firebase.auth.GoogleAuthProvider()

  firebase
    .auth()
    .signInWithPopup(provider)
    .then((result) => {
      user = result.user
      setLoggedIn(true)

      setPictureLoading(true)

      const myCard = getUserCardDataRef(user.uid)

      myCard
        .get()
        .then((doc) => {
          let data = doc.data()

          if (!doc.exists || !data.title || !data.message) {
            data = Object.assign(
              {
                title: 'A Picture',
                message: '',
              },
              data
            )
            myCard.set(data, { merge: true })
          }

          updateCaption(data)
          cardUpdatesUnsubscribe = myCard.onSnapshot((doc) => updateCaption(doc.data()))
        })
        .catch((error) => {
          console.error(error)
          snackbar.genericError.open()
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
              snackbar.genericError.open()
              break
          }
        })
        .finally(() => setPictureLoading(false))
    })
    .catch((error) => {
      console.error(error)
      snackbar.loginError.open()
    })
}

function logout() {
  firebase
    .auth()
    .signOut()
    .then(() => {
      cardUpdatesUnsubscribe()
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
  document.querySelector('#greeting').innerHTML = tf ? `Welcome ${user.displayName.split(' ')[0]}!` : originalGreeting
  document.querySelector('.login-button').style.display = tf ? 'none' : 'initial'
  document.querySelector('.logout-button').style.display = tf ? 'initial' : 'none'
  document.querySelector('.user-content').style.display = tf ? 'initial' : 'none'
  if (tf === false) {
    // reset everything
    cardMedia.style = ''
    updateCaption({ title: '', message: '' })
  }
}

function updateCaption({ title, message }) {
  document.querySelector('#title').innerText = title
  document.querySelector('#message').innerText = message
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
  getUserCardDataRef(user.uid).update({ message: message.slice(0, MessageLengthMax) })
}

function updateTitle(title) {
  if (user === null) return
  getUserCardDataRef(user.uid).update({ title: title.slice(0, TitleLengthMax) })
}

function formatFileSize(number) {
  const unit = 'B'
  let prefixes = ['', 'K', 'M', 'G']

  let powers = Object.keys(prefixes).map((p) => 1024 ** p)
  let rank = powers.reduce((rank, threshold) => rank + (number >= threshold), -1)
  let value = number / powers[rank]

  const numDecimals = 1 - (value >= 10)
  value = Math.ceil(value * 10 ** numDecimals) / 10 ** numDecimals
  return `${value.toFixed(numDecimals)}${prefixes[rank]}${unit}`
}

function updateFileSize(size) {
  document.querySelector('.file-size').innerText = size > 0 ? formatFileSize(size) : ''
}

function setPictureTooBig(tf) {
  document.querySelector('.file-size').classList[tf ? 'add' : 'remove']('too-big')
  tf && snackbar.pictureTooBig.open()
}

function ellipsify(str, maxLength) {
  if (str.length <= maxLength) return str
  const midLength = (maxLength - 1) / 2
  return `${str.slice(0, Math.floor(midLength))}…${str.slice(-Math.ceil(midLength))}`
}

const isImage = (file) => /image\/\w+/.test(file.type)

function resetFileInput() {
  document.querySelector('#picture-upload').form.reset()
}

function uploadFile(files) {
  if (user === null) return

  updateFileSize(0)
  setPictureTooBig(false)

  if (files.length === 0) return

  const imageRef = getUserCardImageRef(user.uid)

  const file = files.item(0)

  if (!isImage(file)) {
    snackbar.wrongFileType.open()
    resetFileInput()
    return
  }

  updateFileSize(file.size)

  if (file.size > FileSizeLimit) {
    setPictureTooBig(true)
    return
  }

  setPictureLoading(true)

  imageRef
    .put(file)
    .then((snapshot) => {
      snapshot.ref.getDownloadURL().then((url) => {
        updatePicture(url)
        updateMessage(ellipsify(file.name, MessageLengthMax))
      })
    })
    .catch((error) => {
      console.error(error)
      if (!isImage(file)) {
        snackbar.wrongFileType.open()
        resetFileInput()
      } else if (file.size > FileSizeLimit) setPictureTooBig(true)
      else snackbar.genericError.open()
    })
    .finally(() => {
      setPictureLoading(false)
    })
}
