declare module "@heruka_urgyen/react-playing-cards/lib/TcN" {
  import { FC } from "react";

  interface PlayingCardProps {
    card: string;
    height: string;
    back?: boolean;
    front?: boolean;
    style?: React.CSSProperties;
    className?: string;
  }

  const PlayingCard: FC<PlayingCardProps>;
  export default PlayingCard;
}
