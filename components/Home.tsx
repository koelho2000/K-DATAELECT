import React from 'react';
import { ViewMode } from '../types';

interface HomeProps {
  onStart: () => void;
}

const Home: React.FC<HomeProps> = ({ onStart }) => {
  const currentYear = new Date().getFullYear();
  const currentDate = new Date().toLocaleDateString('pt-PT');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 overflow-hidden relative">
      {/* Background decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-600 rounded-full blur-3xl"></div>
      </div>

      <div className="z-10 text-center max-w-2xl">
        <div className="mb-2">
          <span className="text-blue-500 font-mono text-sm tracking-widest uppercase">By Koelho2000</span>
        </div>
        
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
          K-DATAELECT
        </h1>
        
        <div className="flex items-center justify-center gap-4 mb-12 text-slate-400 font-medium">
          <span className="px-3 py-1 bg-slate-800 rounded-full border border-slate-700 text-xs">Versão 1.3</span>
          <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
          <span className="text-xs uppercase tracking-widest">{currentDate}</span>
        </div>

        <p className="text-lg text-slate-300 mb-12 leading-relaxed">
          Ferramenta profissional de análise de telecontagem elétrica e geração de relatórios automatizados com inteligência artificial.
        </p>

        <div className="flex flex-col items-center gap-6">
          <button 
            onClick={onStart}
            className="group relative px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-2xl shadow-blue-900/20 transition-all duration-300 transform hover:-translate-y-1 active:scale-95 flex items-center gap-3"
          >
            <span>Iniciar Aplicação</span>
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>

          <a 
            href="https://www.koelho2000.com" 
            target="_blank" 
            rel="noreferrer" 
            className="text-slate-500 hover:text-blue-400 transition-colors text-sm font-medium tracking-wide"
          >
            www.koelho2000.com
          </a>
        </div>
      </div>

      <div className="absolute bottom-8 text-[10px] text-slate-600 uppercase tracking-[0.3em] font-bold">
        &copy; {currentYear} K-DATAELECT &bull; Todos os direitos reservados
      </div>
    </div>
  );
};

export default Home;
