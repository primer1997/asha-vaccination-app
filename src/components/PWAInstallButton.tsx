import React, { useState } from 'react';
import { motion } from 'motion/react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Share, X } from 'lucide-react';
import { Modal } from './ui';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={install}
        className="flex items-center gap-1.5 rounded-full bg-amber-400 px-4 py-1.5 text-sm font-extrabold text-emerald-950 shadow-lg shadow-amber-950/30 transition hover:bg-amber-300"
      >
        <Download size={15} />
        अॅप इंस्टॉल करा
      </motion.button>
    );
  }

  if (isIOS) {
    return (
      <>
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-full bg-amber-400 px-4 py-1.5 text-sm font-extrabold text-emerald-950 shadow-lg shadow-amber-950/30 transition hover:bg-amber-300"
        >
          <Download size={15} />
          iOS वर इंस्टॉल करा
        </motion.button>

        <Modal open={showIOSGuide} onClose={() => setShowIOSGuide(false)} maxWidth="max-w-sm">
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-800">iPhone/iPad वर इन्स्टॉल करा</h3>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="rounded-full bg-slate-100 p-1.5 text-slate-400 transition hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-700">
              <p className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">1</span>
                <span>
                  Safari च्या खालील मेनूमध्ये <strong>Share</strong>{' '}
                  <Share size={16} className="inline text-blue-500" /> बटनावर क्लिक करा.
                </span>
              </p>
              <p className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">2</span>
                <span>
                  खाली स्क्रोल करून <strong>Add to Home Screen</strong> हा पर्याय निवडा.
                </span>
              </p>
            </div>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-6 w-full rounded-xl bg-emerald-800 py-3 text-sm font-bold text-white transition hover:bg-emerald-900 active:scale-95"
            >
              समजले
            </button>
          </div>
        </Modal>
      </>
    );
  }

  return null;
};
