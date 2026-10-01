import React from 'react';

const UserNotRegisteredError = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F7FA] dark:bg-[#080C14] p-4">
      <div className="max-w-md w-full p-8 bg-white dark:bg-[#0D1322] rounded-2xl shadow-sm border border-slate-200 dark:border-[#1E293B]">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-primary/15 dark:bg-[#00d8b8]/15">
            <svg className="w-8 h-8 text-primary dark:text-[#00d8b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-3">Acesso restrito</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
            Você não está cadastrado para usar este aplicativo. Entre em contato com o administrador para solicitar acesso.
          </p>
          <div className="p-4 bg-slate-50 dark:bg-[#131D2E] rounded-xl text-xs text-slate-600 dark:text-slate-300 text-left border border-slate-100 dark:border-[#1E293B]">
            <p className="font-bold text-slate-700 dark:text-slate-200">Se acredita que isso é um erro, você pode:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Verificar se entrou com a conta correta</li>
              <li>Entrar em contato com o administrador do app</li>
              <li>Sair e entrar novamente</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;
