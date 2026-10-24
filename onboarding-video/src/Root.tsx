import { Composition } from "remotion";
import {StartupPreview} from "./StartupMark";
import { WelcomeFilm } from "./WelcomeFilm";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="ZunisStartup" component={StartupPreview} durationInFrames={240} fps={60} width={1280} height={720}/>
      <Composition
        id="AppIntroduction"
        component={WelcomeFilm}
        durationInFrames={300}
        fps={30}
        width={1280}
        height={720}
        defaultProps={{ variant: "overview", reducedMotion: false }}
      />
      <Composition
        id="TeacherIntroduction"
        component={WelcomeFilm}
        durationInFrames={300}
        fps={30}
        width={1280}
        height={720}
        defaultProps={{ variant: "teacher", reducedMotion: false }}
      />
      <Composition
        id="StudentIntroduction"
        component={WelcomeFilm}
        durationInFrames={300}
        fps={30}
        width={1280}
        height={720}
        defaultProps={{ variant: "student", reducedMotion: false }}
      />
    </>
  );
};
