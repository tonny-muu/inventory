import { Col, Form, Row } from 'react-bootstrap';

export default function DateRange({ from, to, onFrom, onTo }) {
  return (
    <Row className="g-2 mb-3" style={{ maxWidth: 420 }}>
      <Col>
        <Form.Label className="small mb-0">From</Form.Label>
        <Form.Control type="date" value={from} onChange={(e) => onFrom(e.target.value)} />
      </Col>
      <Col>
        <Form.Label className="small mb-0">To</Form.Label>
        <Form.Control type="date" value={to} onChange={(e) => onTo(e.target.value)} />
      </Col>
    </Row>
  );
}