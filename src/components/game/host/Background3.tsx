"use client";

interface Background1Props {
  isFlashing: boolean;
}

export default function Background1({ isFlashing }: Background1Props) {
  return (
    <>
      <div
        className={`absolute inset-0 blood-background ${isFlashing ? "flash-effect" : ""}`}
      >

        {/* Container untuk 2.png (awan) */}
        <div className="background-container-groundtiga">
          <div
            className="background-image"
            style={{
              backgroundImage: "url('/map6/1.webp')",
              backgroundSize: "100%",
              backgroundPosition: "center calc(100% + 25px)",
              backgroundRepeat: "no-repeat",
            }}
          />
          <div
            className="background-image"
            style={{
              backgroundImage: "url('/map6/1.webp')",
              backgroundSize: "100%",
              backgroundPosition: "center calc(100% + 25px)",
              backgroundRepeat: "no-repeat",
            }}
          />
        </div>
        {/* Container untuk 3.png (tanah) */}
        <div className="background-container-grounddua">
          <div
            className="background-image"
            style={{
              backgroundImage: "url('/map6/3.webp')",
              backgroundSize: "106%",
              backgroundPosition: "center calc(100% + 103px)",
              backgroundRepeat: "no-repeat",
            }}
          />
          <div
            className="background-image"
            style={{
              backgroundImage: "url('/map6/3.webp')",
              backgroundSize: "106%",
              backgroundPosition: "center calc(100% + 103px)",
              backgroundRepeat: "scaleX(-1)"
            }}
          />
        </div>
        {/* Container untuk 4.png (tanah tambahan) */}
        <div className="background-container-ground">
          <div
            className="background-image"
            style={{
              backgroundImage: "url('/map6/4.webp')",
              backgroundSize: "100%",
              backgroundPosition: "center calc(100% + 10px)",
              backgroundRepeat: "no-repeat",
            }}
          />
          <div
            className="background-image"
            style={{
              backgroundImage: "url('/map6/4.webp')",
              backgroundSize: "100%",
              backgroundPosition: "center calc(100% + 10px)",
              backgroundRepeat: "no-repeat",
            }}
          />
        </div>

        <div className="background-container-ground">
          <div
            className="background-image"
            style={{
              backgroundImage: "url('/map6/5.webp')",
              backgroundSize: "100%",
              backgroundPosition: "center calc(100% + 10px)",
              backgroundRepeat: "no-repeat",
            }}
          />
          <div
            className="background-image"
            style={{
              backgroundImage: "url('/map6/5.webp')",
              backgroundSize: "100%",
              backgroundPosition: "center calc(100% + 10px)",
              backgroundRepeat: "no-repeat",
            }}
          />
        </div>





        <div className="background-container-ground">
          <div
            className="background-image"
            style={{
              backgroundImage: "url('/map6/7.webp')",
              backgroundSize: "100%",
              backgroundPosition: "center calc(100% + 10px)",
              backgroundRepeat: "no-repeat",
            }}
          />
          <div
            className="background-image"
            style={{
              backgroundImage: "url('/map6/7.webp')",
              backgroundSize: "100%",
              backgroundPosition: "center calc(100% + 10px)",
              backgroundRepeat: "no-repeat",
            }}
          />
        </div>


        <div className="background-container-ground">
          <div
            className="background-image"
            style={{
              backgroundImage: "url('/map6/8.webp')",
              backgroundSize: "100%",
              backgroundPosition: "center calc(100% + 10px)",
              backgroundRepeat: "no-repeat",
            }}
          />
          <div
            className="background-image"
            style={{
              backgroundImage: "url('/map6/8.webp')",
              backgroundSize: "100%",
              backgroundPosition: "center calc(100% + 10px)",
              backgroundRepeat: "no-repeat",
            }}
          />
        </div>


        <div className="mist-effect" />
      </div>
      <style jsx>{`
        .background-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 200%;
          height: 100%;
          display: flex;
          animation: slide 20s linear infinite;
        }
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

        .background-image {
          width: 50%;
          height: 100%;
          flex-shrink: 0;
        }
        @keyframes slide {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
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
        .moon-image {
          position: absolute;
          top: 30px;
          right: 50px;
          width: 100px;
          height: 100px;
          object-fit: cover;
          z-index: 10;
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
          .moon-image {
            width: 60px;
            height: 60px;
            top: 20px;
            right: 20px;
          }
        }
      `}</style>
    </>
  );
}