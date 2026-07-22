import { useParams } from 'react-router-dom';

export default function DeductionDetail() {
  const { id } = useParams();

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Deduction #{id}</h1>
      <p className="text-muted-foreground mt-2">Deduction details</p>
    </div>
  );
}
