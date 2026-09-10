// import { BrowserRouter, Routes, Route } from 'react-router-dom'
// import { AuthProvider } from './context/AuthContext'
// import Navbar from './components/Navbar'
// import ProtectedRoute from './components/ProtectedRoute'
// import Booth from './components/Booth/Booth'
// import Login from './components/Auth/Login'
// import Signup from './components/Auth/Signup'
// import Gallery from './components/Gallery/Gallery'

// export default function App() {
//   return (
//     <AuthProvider>
//       <BrowserRouter>
//         <div className="app-shell">
//           <Navbar />
//           <main className="app-main">
//             <Routes>
//               <Route path="/" element={<Booth />} />
//               <Route path="/login" element={<Login />} />
//               <Route path="/signup" element={<Signup />} />
//               <Route
//                 path="/gallery"
//                 element={
//                   <ProtectedRoute>
//                     <Gallery />
//                   </ProtectedRoute>
//                 }
//               />
//             </Routes>
//           </main>
//         </div>
//       </BrowserRouter>
//     </AuthProvider>
//   )
// }
