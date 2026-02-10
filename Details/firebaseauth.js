// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore, setDoc, doc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBa9VbJQkMpe76tE6Tyx_lceWti6fqsIz8",
  authDomain: "jack-s-data.firebaseapp.com",
  projectId: "jack-s-data",
  storageBucket: "jack-s-data.firebasestorage.app",
  messagingSenderId: "770111127127",
  appId: "1:770111127127:web:3c39475cfeeecc72f9ad12"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

// Show message helper
function showMessage(message, divId) {
  const messageDiv = document.getElementById(divId);
  messageDiv.style.display = "block";
  messageDiv.innerHTML = message;
  messageDiv.style.opacity = "1";
  setTimeout(() => {
    messageDiv.style.opacity = "0";
  }, 5000);
}

// ==================== SIGN UP ====================
document.getElementById('submitSignUp').addEventListener('click', (event) => {
  event.preventDefault();
  const email = document.getElementById('suEmail').value;
  const password = document.getElementById('suPassword').value;
  const username = document.getElementById('suUsername').value;

  createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      const user = userCredential.user;
      const userData = { email, username };
      const docRef = doc(db, "users", user.uid);
      setDoc(docRef, userData)
        .then(() => {
          showMessage('Account Created Successfully', 'signUpMessage');
          setTimeout(() => window.location.href = 'Userloginpage.html', 1500);
        })
        .catch((error) => console.error("Error writing document", error));
    })
    .catch((error) => {
      if (error.code === 'auth/email-already-in-use') {
        showMessage('Email Already Exists!', 'signUpMessage');
      } else {
        showMessage('Unable to create user', 'signUpMessage');
      }
    });
});

// ==================== LOGIN ====================
document.getElementById('submitLogin').addEventListener('click', (event) => {
  event.preventDefault();
  const email = document.getElementById('email').value; // Firebase only works with email
  const password = document.getElementById('password').value;

  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      showMessage('Login Successful', 'loginMessage');
      const user = userCredential.user;
      localStorage.setItem('loggedInUserId', user.uid);
      setTimeout(() => window.location.href = 'cart33.html', 1000);
    })
    .catch((error) => {
      if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        showMessage('Incorrect Email or Password', 'loginMessage');
      } else {
        showMessage('Login Error', 'loginMessage');
      }
    });
});

// ==================== FORGOT PASSWORD ====================
document.getElementById('forgotPassword').addEventListener('click', (event) => {
  event.preventDefault();
  const email = prompt("Enter your registered email for password reset:");
  if (!email) return;

  sendPasswordResetEmail(auth, email)
    .then(() => {
      alert("Password reset email sent! Check your inbox or spam folder.");
    })
    .catch((error) => {
      if (error.code === 'auth/user-not-found') {
        alert("No account found with this email.");
      } else if (error.code === 'auth/invalid-email') {
        alert("Invalid email address.");
      } else {
        alert("Error sending password reset email: " + error.message);
      }
    });
});
