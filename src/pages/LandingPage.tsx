import React from 'react';
import { Link } from 'react-router-dom';
import { SwimmingIcon } from '../components/icons/SwimmingIcon';
import { ClipboardCheckIcon } from '../components/icons/ClipboardCheckIcon';
import { UsersIcon } from '../components/icons/UsersIcon';
import { PodiumIcon } from '../components/icons/PodiumIcon';
import { CheckBadgeIcon } from '../components/icons/CheckBadgeIcon';

const LandingPage: React.FC = () => {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 min-h-screen">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-10 py-4 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto flex justify-between items-center">
          <Link to="/" className="flex items-center space-x-2">
            <SwimmingIcon className="h-8 w-8 text-primary" />
            <span className="font-bold text-xl">Swim Manager</span>
          </Link>
          <Link 
            to="/login" 
            className="bg-primary hover:bg-primary-dark text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 ease-in-out"
          >
            Login
          </Link>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-28 text-center bg-white dark:bg-gray-800 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary-light/20 to-transparent dark:from-primary-dark/20"></div>
          <div className="container mx-auto px-4 relative">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Manajemen Kejuaraan Renang Profesional
            </h1>
            <p className="mt-4 max-w-2xl mx-auto text-lg md:text-xl text-gray-600 dark:text-gray-300">
              Platform lengkap untuk mengelola acara, pendaftaran atlet, heat sheet, hingga hasil akhir secara efisien, akurat, dan real-time.
            </p>
            <div className="mt-8 flex justify-center">
              <Link 
                to="/login"
                className="inline-block bg-primary hover:bg-primary-dark text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg transform hover:scale-105 transition-transform duration-300"
              >
                Mulai Kelola Acara Anda
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 sm:py-20 bg-gray-50 dark:bg-gray-900">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight">Fitur Unggulan</h2>
              <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">Semua yang Anda butuhkan untuk kompetisi yang sukses.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
                <div className="flex justify-center items-center h-16 w-16 mx-auto bg-primary-light/20 rounded-full mb-4">
                  <ClipboardCheckIcon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Manajemen Acara Terpusat</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Buat acara, atur program lomba, dan kelola pendaftaran klub dengan mudah dalam satu dasbor.
                </p>
              </div>
              {/* Feature 2 */}
              <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
                <div className="flex justify-center items-center h-16 w-16 mx-auto bg-primary-light/20 rounded-full mb-4">
                  <UsersIcon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Pendaftaran Atlet & Klub</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Klub dapat mendaftarkan atlet mereka sendiri dan memasukkan seed time dengan cepat, mengurangi beban panitia.
                </p>
              </div>
              {/* Feature 3 */}
              <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
                <div className="flex justify-center items-center h-16 w-16 mx-auto bg-primary-light/20 rounded-full mb-4">
                  <PodiumIcon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Hasil Kejuaraan Real-time</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Masukkan waktu final langsung di sistem. Heat sheets, starting list, dan buku hasil dibuat secara otomatis.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-16 sm:py-20 bg-white dark:bg-gray-800">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight">Dipercaya oleh Penyelenggara</h2>
              <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">Lihat apa kata mereka tentang Swim Manager.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg shadow-md">
                <CheckBadgeIcon className="h-8 w-8 text-green-500 mb-2" />
                <blockquote className="text-lg italic">
                  "Aplikasi ini mengubah cara kami menyelenggarakan kejuaraan. Semuanya jadi lebih cepat dan bebas kesalahan. Buku hasil bisa langsung dibagikan sesaat setelah acara terakhir selesai!"
                </blockquote>
                <footer className="mt-4 font-semibold">- Ketua Panitia, Kejuaraan Renang Regional</footer>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg shadow-md">
                <CheckBadgeIcon className="h-8 w-8 text-green-500 mb-2" />
                <blockquote className="text-lg italic">
                  "Koordinasi dengan klub-klub peserta menjadi sangat mudah. Tidak ada lagi pendaftaran via email atau spreadsheet yang berantakan. Swim Manager adalah solusi yang kami butuhkan."
                </blockquote>
                <footer className="mt-4 font-semibold">- Admin, Kompetisi Renang Antarklub</footer>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-gray-50 dark:bg-gray-900 py-20">
            <div className="container mx-auto text-center px-4">
                <h2 className="text-3xl font-bold tracking-tight mb-4">Siap untuk Kejuaraan yang Lebih Baik?</h2>
                <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">Hubungi kami untuk mendapatkan akun Admin dan mulailah menyelenggarakan acara renang kelas dunia.</p>
                <Link 
                    to="/login"
                    className="inline-block bg-primary hover:bg-primary-dark text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg transform hover:scale-105 transition-transform duration-300"
                >
                    Masuk atau Hubungi Kami
                </Link>
            </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t dark:border-gray-700">
        <div className="container mx-auto py-6 px-4 text-center text-gray-600 dark:text-gray-400">
          <p>&copy; {new Date().getFullYear()} Swim Manager. All Rights Reserved.</p>
          <p className="text-sm mt-1">contact@swim-manager-service.com</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;