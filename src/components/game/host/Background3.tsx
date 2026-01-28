"use client";
import Image from "next/image";

interface Background1Props {
  isFlashing: boolean;
}

export default function Background1({ isFlashing }: Background1Props) {
  return (
    <>
      <div
        className={`absolute inset-0 blood-background ${isFlashing ? "flash-effect" : ""}`}
      >
        {/* Container untuk 2.png (awan) - Layer 1 */}
        <div className="background-container-groundtiga">
          <div className="relative w-1/2 h-full flex-shrink-0">
            <Image
              src="/map6/1.webp"
              alt="Cloud 1"
              width={0}
              height={0}
              sizes="50vw"
              className="absolute left-0 w-full h-auto"
              style={{ bottom: '-25px' }}
              priority
            />
          </div>
          <div className="relative w-1/2 h-full flex-shrink-0">
            <Image
              src="/map6/1.webp"
              alt="Cloud 2"
              width={0}
              height={0}
              sizes="50vw"
              className="absolute left-0 w-full h-auto"
              style={{ bottom: '-25px' }}
              priority
            />
          </div>
        </div>

        {/* Container untuk 3.png (tanah) - Layer 2 */}
        <div className="background-container-grounddua">
          <div className="relative w-1/2 h-full flex-shrink-0">
            <Image
              src="/map6/3.webp"
              alt="Ground 1"
              width={0}
              height={0}
              sizes="50vw"
              className="absolute left-0 w-full h-auto"
              style={{ bottom: '-103px' }}
              priority
            />
          </div>
          <div className="relative w-1/2 h-full flex-shrink-0">
            <Image
              src="/map6/3.webp"
              alt="Ground 2"
              width={0}
              height={0}
              sizes="50vw"
              className="absolute left-0 w-full h-auto scale-x-[-1]"
              style={{ bottom: '-103px' }}
              priority
            />
          </div>
        </div>

        {/* Container untuk 4.png - Layer 3 */}
        <div className="background-container-ground">
          <div className="relative w-1/2 h-full flex-shrink-0">
            <Image
              src="/map6/4.webp"
              alt="Layer 4-1"
              width={0}
              height={0}
              sizes="50vw"
              className="absolute left-0 w-full h-auto"
              style={{ bottom: '-10px' }}
            />
          </div>
          <div className="relative w-1/2 h-full flex-shrink-0">
            <Image
              src="/map6/4.webp"
              alt="Layer 4-2"
              width={0}
              height={0}
              sizes="50vw"
              className="absolute left-0 w-full h-auto"
              style={{ bottom: '-10px' }}
            />
          </div>
        </div>

        {/* Container untuk 5.png - Layer 4 */}
        <div className="background-container-ground">
          <div className="relative w-1/2 h-full flex-shrink-0">
            <Image
              src="/map6/5.webp"
              alt="Layer 5-1"
              width={0}
              height={0}
              sizes="50vw"
              className="absolute left-0 w-full h-auto"
              style={{ bottom: '-10px' }}
            />
          </div>
          <div className="relative w-1/2 h-full flex-shrink-0">
            <Image
              src="/map6/5.webp"
              alt="Layer 5-2"
              width={0}
              height={0}
              sizes="50vw"
              className="absolute left-0 w-full h-auto"
              style={{ bottom: '-10px' }}
            />
          </div>
        </div>

        {/* Container untuk 7.png - Layer 5 */}
        <div className="background-container-ground">
          <div className="relative w-1/2 h-full flex-shrink-0">
            <Image
              src="/map6/7.webp"
              alt="Layer 7-1"
              width={0}
              height={0}
              sizes="50vw"
              className="absolute left-0 w-full h-auto"
              style={{ bottom: '-10px' }}
            />
          </div>
          <div className="relative w-1/2 h-full flex-shrink-0">
            <Image
              src="/map6/7.webp"
              alt="Layer 7-2"
              width={0}
              height={0}
              sizes="50vw"
              className="absolute left-0 w-full h-auto"
              style={{ bottom: '-10px' }}
            />
          </div>
        </div>

        {/* Container untuk 8.png - Layer 6 */}
        <div className="background-container-ground">
          <div className="relative w-1/2 h-full flex-shrink-0">
            <Image
              src="/map6/8.webp"
              alt="Layer 8-1"
              width={0}
              height={0}
              sizes="50vw"
              className="absolute left-0 w-full h-auto"
              style={{ bottom: '-10px' }}
            />
          </div>
          <div className="relative w-1/2 h-full flex-shrink-0">
            <Image
              src="/map6/8.webp"
              alt="Layer 8-2"
              width={0}
              height={0}
              sizes="50vw"
              className="absolute left-0 w-full h-auto"
              style={{ bottom: '-10px' }}
            />
          </div>
        </div>

        <div className="mist-effect" />
      </div>

      <style jsx>{`
        .background-container-ground {
          position: absolute;
          top: 0;
          left: 0;
          width: 200%;
          height: 100%;
          display: flex;
          animation: slide-ground 5s linear infinite;
        }

         .background-container-grounddua {
          position: absolute;
          top: 0;
          left: 0;
          width: 200%;
          height: 100%;
          display: flex;
          animation: slide-ground 17s linear infinite;
        }

          .background-container-groundtiga {
          position: absolute;
          top: 0;
          left: 0;
          width: 200%;
          height: 100%;
          display: flex;
          animation: slide-ground 45s linear infinite;
        }

        @keyframes slide-ground {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .mist-effect {
          position: absolute;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 70%);
          animation: mist-move 20s linear infinite;
          opacity: 0.3;
          pointer-events: none;
        }
        @keyframes mist-move {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0%); }
        }
        .blood-background::before {
          content: '';
          position: absolute;
          top: 0;
          left: 20%;
          width: 10px;
          height: 30px;
          background: radial-gradient(circle, rgba(255, 0, 0, 0.7) 0%, rgba(255, 0, 0, 0) 70%);
          animation: blood-drip 2s infinite;
          pointer-events: none;
        }
        .blood-background::after {
          content: '';
          position: absolute;
          top: 0;
          left: 80%;
          width: 10px;
          height: 30px;
          background: radial-gradient(circle, rgba(255, 0, 0, 0.7) 0%, rgba(255, 0, 0, 0) 70%);
          animation: blood-drip 2.5s infinite 0.5s;
          pointer-events: none;
        }
        @keyframes blood-drip {
          0% { transform: translateY(-10px); opacity: 0; }
          50% { transform: translateY(50vh); opacity: 0.7; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        .flash-effect {
          animation: flash 0.5s ease-in-out;
        }
        @keyframes flash {
          0%, 100% { background-color: rgba(255, 0, 0, 0); }
          50% { background-color: rgba(255, 0, 0, 0.3); }
        }
        @media (max-width: 640px) {
          .mist-effect {
            width: 300%;
            height: 300%;
          }
          .blood-background::before,
          .blood-background::after {
            width: 8px;
            height: 20px;
          }
        }
      `}</style>
    </>
  );
}