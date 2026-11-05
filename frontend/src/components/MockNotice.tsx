/**
 * 아직 백엔드 API에 연결하지 않은 화면에 붙이는 안내.
 * 이 화면의 데이터와 입력은 브라우저 안의 가상 데이터라서 서버(DB)에 저장되지 않는다.
 * 해당 화면을 실제 API로 연결하면 라우트(App.tsx)에서 이 안내를 뺀다.
 */
export default function MockNotice() {
  return (
    <p className="banner banner--mock" role="note">
      <strong>가상 데이터 화면</strong> 이 화면은 아직 서버와 연결되지 않았어요. 보이는 내용과 입력한 내용은 서버(DB)에 저장되지 않아요.
    </p>
  );
}
