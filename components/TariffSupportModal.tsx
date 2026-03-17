import React from 'react';

import { TariffOption } from '../types';

interface TariffSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tariffOption: TariffOption;
}

const TariffSupportModal: React.FC<TariffSupportModalProps> = ({ isOpen, onClose, tariffOption }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-2xl font-bold text-slate-900">Guia de Ciclos Tarifários</h3>
            <p className="text-sm text-slate-500">Portugal Continental - Ciclo {tariffOption}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-8 overflow-y-auto space-y-8">
          <section>
            <h4 className="text-lg font-bold text-blue-700 mb-4 flex items-center gap-2">
              <span className="w-2 h-6 bg-blue-600 rounded-full"></span>
              Definição de Períodos
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="font-bold text-blue-900 mb-1">Período de Verão</p>
                <p className="text-sm text-blue-800">Inicia no último domingo de março.</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                <p className="font-bold text-orange-900 mb-1">Período de Inverno</p>
                <p className="text-sm text-orange-800">Inicia no último domingo de outubro.</p>
              </div>
            </div>
          </section>

          <section>
            <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-6 bg-slate-600 rounded-full"></span>
              Horários dos Ciclos ({tariffOption})
            </h4>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Winter */}
              <div className="space-y-4">
                <h5 className="font-bold text-slate-700 uppercase tracking-wider text-xs bg-slate-100 p-2 rounded">Inverno</h5>
                <div className="space-y-4 text-sm">
                  {tariffOption === TariffOption.STANDARD ? (
                    <>
                      <div>
                        <p className="font-bold border-b pb-1 mb-2">Segunda a Sexta</p>
                        <ul className="space-y-1">
                          <li><span className="font-semibold text-red-600">Ponta:</span> 09:30-12:00 | 18:30-21:00</li>
                          <li><span className="font-semibold text-blue-600">Cheias:</span> 07:00-09:30 | 12:00-18:30 | 21:00-24:00</li>
                          <li><span className="font-semibold text-green-600">Vazio Normal:</span> 00:00-02:00 | 06:00-07:00</li>
                          <li><span className="font-semibold text-purple-600">Super Vazio:</span> 02:00-06:00</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-bold border-b pb-1 mb-2">Sábado</p>
                        <ul className="space-y-1">
                          <li><span className="font-semibold text-blue-600">Cheias:</span> 09:30-13:00 | 18:30-22:00</li>
                          <li><span className="font-semibold text-green-600">Vazio Normal:</span> 00:00-02:00 | 06:00-09:30 | 13:00-18:30 | 22:00-24:00</li>
                          <li><span className="font-semibold text-purple-600">Super Vazio:</span> 02:00-06:00</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-bold border-b pb-1 mb-2">Domingo</p>
                        <ul className="space-y-1">
                          <li><span className="font-semibold text-green-600">Vazio Normal:</span> 00:00-02:00 | 06:00-24:00</li>
                          <li><span className="font-semibold text-purple-600">Super Vazio:</span> 02:00-06:00</li>
                        </ul>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="font-bold border-b pb-1 mb-2">Segunda a Sexta</p>
                        <ul className="space-y-1">
                          <li><span className="font-semibold text-red-600">Ponta:</span> 17:00-22:00</li>
                          <li><span className="font-semibold text-blue-600">Cheias:</span> 00:00-00:30 | 07:30-17:00 | 22:00-24:00</li>
                          <li><span className="font-semibold text-green-600">Vazio Normal:</span> 00:30-02:00 | 06:00-07:30</li>
                          <li><span className="font-semibold text-purple-600">Super Vazio:</span> 02:00-06:00</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-bold border-b pb-1 mb-2">Sábado</p>
                        <ul className="space-y-1">
                          <li><span className="font-semibold text-blue-600">Cheias:</span> 10:30-12:30 | 17:30-22:30</li>
                          <li><span className="font-semibold text-green-600">Vazio Normal:</span> 00:00-03:00 | 07:00-10:30 | 12:30-17:30 | 22:30-24:00</li>
                          <li><span className="font-semibold text-purple-600">Super Vazio:</span> 03:00-07:00</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-bold border-b pb-1 mb-2">Domingo</p>
                        <ul className="space-y-1">
                          <li><span className="font-semibold text-green-600">Vazio Normal:</span> 00:00-04:00 | 08:00-24:00</li>
                          <li><span className="font-semibold text-purple-600">Super Vazio:</span> 04:00-08:00</li>
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Summer */}
              <div className="space-y-4">
                <h5 className="font-bold text-slate-700 uppercase tracking-wider text-xs bg-slate-100 p-2 rounded">Verão</h5>
                <div className="space-y-4 text-sm">
                  {tariffOption === TariffOption.STANDARD ? (
                    <>
                      <div>
                        <p className="font-bold border-b pb-1 mb-2">Segunda a Sexta</p>
                        <ul className="space-y-1">
                          <li><span className="font-semibold text-red-600">Ponta:</span> 09:15-12:15</li>
                          <li><span className="font-semibold text-blue-600">Cheias:</span> 07:00-09:15 | 12:15-24:00</li>
                          <li><span className="font-semibold text-green-600">Vazio Normal:</span> 00:00-02:00 | 06:00-07:00</li>
                          <li><span className="font-semibold text-purple-600">Super Vazio:</span> 02:00-06:00</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-bold border-b pb-1 mb-2">Sábado</p>
                        <ul className="space-y-1">
                          <li><span className="font-semibold text-blue-600">Cheias:</span> 09:00-14:00 | 20:00-22:00</li>
                          <li><span className="font-semibold text-green-600">Vazio Normal:</span> 00:00-02:00 | 06:00-09:00 | 14:00-20:00 | 22:00-24:00</li>
                          <li><span className="font-semibold text-purple-600">Super Vazio:</span> 02:00-06:00</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-bold border-b pb-1 mb-2">Domingo</p>
                        <ul className="space-y-1">
                          <li><span className="font-semibold text-green-600">Vazio Normal:</span> 00:00-02:00 | 06:00-24:00</li>
                          <li><span className="font-semibold text-purple-600">Super Vazio:</span> 02:00-06:00</li>
                        </ul>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="font-bold border-b pb-1 mb-2">Segunda a Sexta</p>
                        <ul className="space-y-1">
                          <li><span className="font-semibold text-red-600">Ponta:</span> 14:00-17:00</li>
                          <li><span className="font-semibold text-blue-600">Cheias:</span> 00:00-00:30 | 07:30-14:00 | 17:00-24:00</li>
                          <li><span className="font-semibold text-green-600">Vazio Normal:</span> 00:30-02:00 | 06:00-07:30</li>
                          <li><span className="font-semibold text-purple-600">Super Vazio:</span> 02:00-06:00</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-bold border-b pb-1 mb-2">Sábado</p>
                        <ul className="space-y-1">
                          <li><span className="font-semibold text-blue-600">Cheias:</span> 10:00-13:30 | 19:30-23:00</li>
                          <li><span className="font-semibold text-green-600">Vazio Normal:</span> 00:00-03:30 | 07:30-10:00 | 13:30-19:30 | 23:00-24:00</li>
                          <li><span className="font-semibold text-purple-600">Super Vazio:</span> 03:30-07:30</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-bold border-b pb-1 mb-2">Domingo</p>
                        <ul className="space-y-1">
                          <li><span className="font-semibold text-green-600">Vazio Normal:</span> 00:00-04:00 | 08:00-24:00</li>
                          <li><span className="font-semibold text-purple-600">Super Vazio:</span> 04:00-08:00</li>
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors">
            Fechar Guia
          </button>
        </div>
      </div>
    </div>
  );
};

export default TariffSupportModal;
